const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve((request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return new Response(JSON.stringify({
    error: 'Endpoint de exclusão legado desativado por segurança. Use o fluxo administrativo de exclusão segura, com prévia, confirmação e retenção de históricos.',
  }), {
    status: 410,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
});
