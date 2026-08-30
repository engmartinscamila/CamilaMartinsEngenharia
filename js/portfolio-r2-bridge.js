/*
==========================================================
CAMILA MARTINS ENGENHARIA
PONTE DA GALERIA: painel existente -> Cloudflare R2 + GitHub
==========================================================
*/
(function(){
  "use strict";

  const API = "https://cme-public-media.eng-martins-camila.workers.dev";
  const PORTFOLIO_BUCKET = "projetos";
  const MANIFEST_PATH = "portfolio/galeria.json";
  const MAX_UPLOAD = 95 * 1024 * 1024;
  const WATERMARK = "Camila Martins Engenharia";

  if (!window.supabaseClient || !window.supabaseClient.storage) {
    console.error("Ponte R2: Supabase ainda não está disponível.");
    return;
  }

  const originalFrom = window.supabaseClient.storage.from.bind(window.supabaseClient.storage);
  const pendingDeletes = new Set();
  const pendingUploads = new Set();

  window.supabaseClient.storage.from = function(bucket){
    if (String(bucket) !== PORTFOLIO_BUCKET) {
      return originalFrom(bucket);
    }

    return {
      upload: upload,
      update: upload,
      remove: remove,
      getPublicUrl: getPublicUrl,
      createSignedUrl: createSignedUrl,
      list: list
    };
  };

  async function upload(path, body, options){
    try {
      const normalized = normalizePath(path);

      if (normalized === MANIFEST_PATH) {
        const manifest = await readJsonBody(body);
        const token = await adminToken();

        if (pendingDeletes.size) {
          const response = await fetch(API + "/api/delete-batch", {
            method: "POST",
            headers: {
              authorization: "Bearer " + token,
              "content-type": "application/json"
            },
            body: JSON.stringify({
              keys: Array.from(pendingDeletes),
              manifest: manifest
            })
          });

          const data = await response.json().catch(function(){ return {}; });

          if (!response.ok || !data.ok) {
            throw new Error(data.error || "Falha ao excluir arquivos e atualizar o catálogo.");
          }

          pendingDeletes.clear();
          pendingUploads.clear();
          return { data: { path: MANIFEST_PATH }, error: null };
        }

        try {
          await putManifest(token, manifest);
          pendingUploads.clear();
          return { data: { path: MANIFEST_PATH }, error: null };
        } catch (error) {
          await rollbackNewUploads(token);
          throw error;
        }
      }

      if (!body) {
        throw new Error("Arquivo ausente.");
      }

      if (typeof body.size === "number" && body.size > MAX_UPLOAD) {
        throw new Error("O arquivo excede o limite seguro de 95 MB por envio.");
      }

      const token = await adminToken();
      let uploadBody = body;
      let contentType = options && options.contentType
        ? options.contentType
        : (body.type || "application/octet-stream");

      if (String(contentType).toLowerCase().startsWith("image/")) {
        uploadBody = await applyWatermark(body);
        contentType = uploadBody.type || contentType;
      }

      const response = await fetch(
        API + "/api/upload?key=" + encodeURIComponent(normalized),
        {
          method: "PUT",
          headers: {
            authorization: "Bearer " + token,
            "content-type": contentType
          },
          body: uploadBody
        }
      );

      const data = await response.json().catch(function(){ return {}; });

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Falha ao enviar o arquivo para o R2.");
      }

      pendingUploads.add(data.key || normalized);

      return {
        data: {
          path: data.key || normalized,
          fullPath: data.key || normalized
        },
        error: null
      };
    } catch (error) {
      console.error("Ponte R2 upload:", error);
      return { data: null, error: error };
    }
  }

  async function remove(paths){
    try {
      const list = Array.isArray(paths) ? paths : [paths];

      list.forEach(function(path){
        const normalized = normalizePath(path);
        if (normalized && normalized !== MANIFEST_PATH) {
          pendingDeletes.add(normalized);
        }
      });

      return {
        data: list.map(function(path){ return { name: normalizePath(path) }; }),
        error: null
      };
    } catch (error) {
      return { data: null, error: error };
    }
  }

  function getPublicUrl(path){
    const normalized = normalizePath(path);

    if (normalized === MANIFEST_PATH) {
      return {
        data: {
          publicUrl: API + "/api/manifest"
        }
      };
    }

    return {
      data: {
        publicUrl: API + "/media/" + normalized.split("/").map(encodeURIComponent).join("/")
      }
    };
  }

  async function createSignedUrl(path){
    return {
      data: {
        signedUrl: getPublicUrl(path).data.publicUrl
      },
      error: null
    };
  }

  async function list(){
    return { data: [], error: null };
  }

  async function putManifest(token, manifest){
    const response = await fetch(API + "/api/manifest", {
      method: "PUT",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json"
      },
      body: JSON.stringify(manifest, null, 2)
    });

    const data = await response.json().catch(function(){ return {}; });

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "O GitHub recusou a atualização da galeria.");
    }

    return data;
  }

  async function rollbackNewUploads(token){
    const keys = Array.from(pendingUploads);

    for (const key of keys) {
      try {
        await fetch(API + "/api/object?key=" + encodeURIComponent(key), {
          method: "DELETE",
          headers: {
            authorization: "Bearer " + token
          }
        });
      } catch (error) {
        console.error("Ponte R2 rollback:", key, error);
      }
    }

    pendingUploads.clear();
  }

  async function adminToken(){
    const result = await window.supabaseClient.auth.getSession();

    if (result.error) {
      throw result.error;
    }

    const token = result.data && result.data.session && result.data.session.access_token;

    if (!token) {
      throw new Error("Sua sessão administrativa expirou. Entre novamente.");
    }

    return token;
  }

  async function readJsonBody(body){
    if (typeof body === "string") {
      return JSON.parse(body);
    }

    if (body && typeof body.text === "function") {
      return JSON.parse(await body.text());
    }

    if (body instanceof ArrayBuffer) {
      return JSON.parse(new TextDecoder().decode(body));
    }

    if (ArrayBuffer.isView(body)) {
      return JSON.parse(new TextDecoder().decode(body));
    }

    if (body && typeof body === "object" && Array.isArray(body.projetos)) {
      return body;
    }

    throw new Error("Manifesto inválido.");
  }

  async function applyWatermark(file){
    if (!file || !String(file.type || "").startsWith("image/")) {
      return file;
    }

    if (typeof createImageBitmap !== "function") {
      console.warn("Ponte R2: navegador sem createImageBitmap; imagem enviada sem processamento.");
      return file;
    }

    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: true });

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    context.drawImage(bitmap, 0, 0);

    const smallerSide = Math.min(canvas.width, canvas.height);
    const fontSize = Math.max(18, Math.round(smallerSide * 0.024));
    const padding = Math.max(16, Math.round(smallerSide * 0.025));

    context.save();
    context.font = "500 " + fontSize + "px Montserrat, Arial, sans-serif";
    context.textAlign = "right";
    context.textBaseline = "bottom";

    const width = context.measureText(WATERMARK).width;
    const x = canvas.width - padding;
    const y = canvas.height - padding;
    const px = Math.max(10, Math.round(fontSize * 0.5));
    const py = Math.max(6, Math.round(fontSize * 0.28));

    context.fillStyle = "rgba(1,9,20,.22)";
    context.fillRect(
      x - width - px * 2,
      y - fontSize - py,
      width + px * 2,
      fontSize + py * 2
    );

    context.strokeStyle = "rgba(0,0,0,.20)";
    context.lineWidth = Math.max(1, fontSize * 0.055);
    context.strokeText(WATERMARK, x - px, y);

    context.fillStyle = "rgba(255,255,255,.58)";
    context.fillText(WATERMARK, x - px, y);
    context.restore();

    if (bitmap.close) bitmap.close();

    const outputType = chooseImageType(file.type, file.name);
    const quality = outputType === "image/jpeg" || outputType === "image/webp"
      ? 0.92
      : undefined;

    return new Promise(function(resolve, reject){
      canvas.toBlob(function(blob){
        if (blob) resolve(blob);
        else reject(new Error("Não foi possível aplicar a marca d'água."));
      }, outputType, quality);
    });
  }

  function chooseImageType(type, name){
    if (type === "image/jpeg" || type === "image/png" || type === "image/webp") {
      return type;
    }

    const ext = String(name || "").split(".").pop().toLowerCase();

    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "png") return "image/png";
    return "image/webp";
  }

  function normalizePath(path){
    return String(path || "")
      .replace(/^\/+/, "")
      .replace(/\\/g, "/")
      .replace(/\/{2,}/g, "/")
      .trim();
  }

  /*
  Compatibilidade com o uploader TUS usado pela versão anterior.
  O painel continua chamando a mesma API, mas o envio real vai para o Worker/R2.
  */
  if (window.tus && window.tus.Upload) {
    window.tus.Upload = function(file, config){
      this.file = file;
      this.config = config || {};
      this.abort = async function(){};

      this.start = async function(){
        try {
          const metadata = this.config.metadata || {};
          const objectName = metadata.objectName || metadata.filename || (file && file.name) || "arquivo";
          const normalized = normalizePath(
            objectName.startsWith("portfolio/")
              ? objectName
              : "portfolio/" + objectName
          );

          const result = await upload(
            normalized,
            file,
            { contentType: (file && file.type) || metadata.filetype || "application/octet-stream" }
          );

          if (result.error) throw result.error;

          if (typeof this.config.onProgress === "function") {
            const size = (file && file.size) || 1;
            this.config.onProgress(size, size);
          }

          if (typeof this.config.onSuccess === "function") {
            this.config.onSuccess();
          }
        } catch (error) {
          if (typeof this.config.onError === "function") {
            this.config.onError(error);
          }
        }
      };
    };
  }

  window.CME_PORTFOLIO_R2_BRIDGE = {
    api: API,
    bucket: PORTFOLIO_BUCKET,
    manifestPath: MANIFEST_PATH
  };
})();