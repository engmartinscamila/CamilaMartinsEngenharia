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

        // Nunca apagar arquivo que o catálogo salvo ainda usa (foto compartilhada entre projetos).
        const stillReferenced = manifestReferencedKeys(manifest);
        Array.from(pendingDeletes).forEach(function(key){
          if (stillReferenced.has(key)) pendingDeletes.delete(key);
        });

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
      } else if (String(contentType).toLowerCase().startsWith("video/")) {
        uploadBody = await watermarkVideo(body);
        contentType = "video/mp4";
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

  const TILED_TEXT = "CAMILA MARTINS ENGENHARIA  •  camilamartinsengenharia.com.br";
  function drawTiledWatermark(context, width, height){
    const size = Math.max(14, Math.round(Math.min(width, height) / 30));
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate(-30 * Math.PI / 180);
    context.font = "600 " + size + "px Montserrat, Arial, sans-serif";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.lineWidth = Math.max(1, size * 0.05);
    context.strokeStyle = "rgba(0,0,0,.08)";
    context.fillStyle = "rgba(255,255,255,.17)";
    const along = context.measureText(TILED_TEXT).width + size * 3;
    const gap = size * 5.5;
    const span = Math.hypot(width, height);
    for (let row = -Math.ceil(span / gap / 2) - 1, i = 0; row <= Math.ceil(span / gap / 2) + 1; row += 1, i += 1) {
      const shift = (i % 2) * along / 2;
      for (let x = -span / 2 - along + shift; x < span / 2; x += along) {
        context.strokeText(TILED_TEXT, x, row * gap);
        context.fillText(TILED_TEXT, x, row * gap);
      }
    }
    context.restore();
  }

  /* Marca timbrada gravada no vídeo, no próprio navegador (FFmpeg em WebAssembly), antes do envio.
     O vídeo publicado já sai marcado; o original fica só com você. */
  const FFMPEG_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd";
  // O worker do FFmpeg roda como módulo: o núcleo precisa ser a versão ESM.
  const FFMPEG_CORE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
  const FFMPEG_UTIL = "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js";
  let ffmpegPromise = null;

  function loadScript(src){
    return new Promise(function(resolve, reject){
      const el = document.createElement("script");
      el.src = src;
      el.onload = resolve;
      el.onerror = function(){ reject(new Error("Não foi possível carregar o gravador de vídeo.")); };
      document.head.appendChild(el);
    });
  }

  function videoNotice(text){
    let box = document.getElementById("cmeVideoMarkNotice");
    if (!text) { if (box) box.remove(); return; }
    if (!box) {
      box = document.createElement("div");
      box.id = "cmeVideoMarkNotice";
      box.setAttribute("role", "status");
      box.style.cssText = "position:fixed;left:16px;right:16px;bottom:16px;z-index:5000;max-width:520px;margin:0 auto;padding:12px 16px;border-radius:12px;background:#010914;color:#f3ece0;font:500 14px Montserrat,Arial,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3)";
      document.body.appendChild(box);
    }
    box.textContent = text;
  }

  async function loadFfmpeg(){
    if (!ffmpegPromise) {
      ffmpegPromise = (async function(){
        if (!window.FFmpegWASM) await loadScript(FFMPEG_BASE + "/ffmpeg.js");
        if (!window.FFmpegUtil) await loadScript(FFMPEG_UTIL);
        const toBlobURL = window.FFmpegUtil.toBlobURL;
        const ffmpeg = new window.FFmpegWASM.FFmpeg();
        await ffmpeg.load({
          coreURL: await toBlobURL(FFMPEG_CORE + "/ffmpeg-core.js", "text/javascript"),
          wasmURL: await toBlobURL(FFMPEG_CORE + "/ffmpeg-core.wasm", "application/wasm"),
          classWorkerURL: await toBlobURL(FFMPEG_BASE + "/814.ffmpeg.js", "text/javascript")
        });
        return ffmpeg;
      })().catch(function(error){ ffmpegPromise = null; throw error; });
    }
    return ffmpegPromise;
  }

  function videoSize(file){
    return new Promise(function(resolve, reject){
      const video = document.createElement("video");
      const url = URL.createObjectURL(file);
      video.preload = "metadata";
      video.muted = true;
      video.onloadedmetadata = function(){ URL.revokeObjectURL(url); resolve({ width: video.videoWidth, height: video.videoHeight }); };
      video.onerror = function(){ URL.revokeObjectURL(url); reject(new Error("Não foi possível ler o vídeo. Envie em MP4 (H.264).")); };
      video.src = url;
    });
  }

  async function videoOverlay(width, height){
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    drawTiledWatermark(context, width, height);
    const size = Math.max(12, Math.round(Math.min(width, height) * 0.03));
    const pad = Math.max(10, Math.round(Math.min(width, height) * 0.02));
    const label = "© CAMILA MARTINS ENGENHARIA";
    context.font = "600 " + size + "px Montserrat, Arial, sans-serif";
    context.textBaseline = "bottom";
    const textWidth = context.measureText(label).width;
    context.fillStyle = "rgba(1,9,20,.6)";
    context.fillRect(pad, height - size - pad * 2.5, textWidth + pad * 2, size + pad * 1.5);
    context.fillStyle = "rgba(255,255,255,.88)";
    context.fillText(label, pad * 2, height - pad * 1.5);
    return new Promise(function(resolve, reject){
      canvas.toBlob(function(blob){ blob ? resolve(blob) : reject(new Error("Falha ao preparar a marca do vídeo.")); }, "image/png");
    });
  }

  async function watermarkVideo(file){
    if (typeof window.WebAssembly !== "object") throw new Error("Este navegador não grava a marca no vídeo. Use o Chrome ou o Edge atualizados.");
    try {
      videoNotice("Gravando a marca timbrada no vídeo... pode levar alguns minutos. Não feche a página.");
      const size = await videoSize(file);
      const ffmpeg = await loadFfmpeg();
      const fetchFile = window.FFmpegUtil.fetchFile;
      ffmpeg.on && ffmpeg.on("progress", function(event){
        const pct = Math.max(0, Math.min(100, Math.round((event.progress || 0) * 100)));
        videoNotice("Gravando a marca timbrada no vídeo... " + pct + "%. Não feche a página.");
      });
      await ffmpeg.writeFile("entrada.mp4", await fetchFile(file));
      await ffmpeg.writeFile("marca.png", await fetchFile(await videoOverlay(size.width, size.height)));
      const code = await ffmpeg.exec([
        "-i", "entrada.mp4", "-i", "marca.png",
        "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
        "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "copy",
        "-movflags", "+faststart", "saida.mp4"
      ]);
      if (code !== 0) throw new Error("O gravador de vídeo não conseguiu processar este arquivo. Envie em MP4 (H.264).");
      const data = await ffmpeg.readFile("saida.mp4");
      await Promise.all(["entrada.mp4", "marca.png", "saida.mp4"].map(function(name){ return ffmpeg.deleteFile(name).catch(function(){}); }));
      return new Blob([data], { type: "video/mp4" });
    } finally {
      videoNotice("");
    }
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

    // Marca timbrada: texto repetido em diagonal pela imagem inteira (recortar um pedaço não a remove).
    drawTiledWatermark(context, canvas.width, canvas.height);

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

  function manifestReferencedKeys(manifest){
    const keys = new Set();
    (function visit(value){
      if (typeof value === "string") {
        const key = normalizePath(value.replace(/^https?:\/\/[^/]+\/media\//i, "").split("?")[0]);
        if (key.indexOf("portfolio/") === 0) keys.add(key);
      } else if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (value && typeof value === "object") {
        Object.keys(value).forEach(function(k){ visit(value[k]); });
      }
    })(manifest);
    return keys;
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

  // Envio direto (sem nova marca) e catálogo, usados pela regravação com marca timbrada.
  async function putObjectRaw(key, blob){
    const token = await adminToken();
    const response = await fetch(API + "/api/upload?key=" + encodeURIComponent(normalizePath(key)), {
      method: "PUT",
      headers: { authorization: "Bearer " + token, "content-type": blob.type || "image/webp" },
      body: blob
    });
    const data = await response.json().catch(function(){ return {}; });
    if (!response.ok || !data.ok) throw new Error(data.error || "Falha ao enviar o arquivo para o R2.");
    return data.key || normalizePath(key);
  }

  async function fetchManifest(){
    const response = await fetch(API + "/api/manifest?v=" + Date.now(), { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível ler a galeria publicada.");
    const manifest = await response.json();
    if (!Array.isArray(manifest && manifest.projetos)) throw new Error("Galeria publicada inválida.");
    return manifest;
  }

  async function publishManifest(manifest){
    return putManifest(await adminToken(), manifest);
  }

  async function deleteKeysWithManifest(keys, manifest){
    const token = await adminToken();
    const response = await fetch(API + "/api/delete-batch", {
      method: "POST",
      headers: { authorization: "Bearer " + token, "content-type": "application/json" },
      body: JSON.stringify({ keys: keys, manifest: manifest })
    });
    const data = await response.json().catch(function(){ return {}; });
    if (!response.ok || !data.ok) throw new Error(data.error || "Falha ao remover as versões antigas.");
    return data;
  }

  async function deleteObjectRaw(key){
    const token = await adminToken();
    await fetch(API + "/api/object?key=" + encodeURIComponent(normalizePath(key)), { method: "DELETE", headers: { authorization: "Bearer " + token } });
  }

  window.CME_PORTFOLIO_R2_BRIDGE = {
    api: API,
    bucket: PORTFOLIO_BUCKET,
    manifestPath: MANIFEST_PATH,
    applyWatermark: applyWatermark,
    watermarkVideo: watermarkVideo,
    drawTiledWatermark: drawTiledWatermark,
    putObjectRaw: putObjectRaw,
    fetchManifest: fetchManifest,
    publishManifest: publishManifest,
    deleteKeysWithManifest: deleteKeysWithManifest,
    deleteObjectRaw: deleteObjectRaw
  };
})();