const DEFAULT_API_HOST = 'https://api.openai.com/v1';
const DEFAULT_IMAGE_MODEL = 'gpt-image-2';
const DEFAULT_IMAGE_SIZE = '1024x1280';

function readEnv(key) {
  const value = process.env[key];
  if (!value) return '';
  return value.trim();
}

function getConfig() {
  const apiKey = readEnv('IMAGE_API_KEY') || readEnv('VORTEXAI_API_KEY') || readEnv('OPENAI_API_KEY');
  const apiHost = (readEnv('IMAGE_API_HOST') || readEnv('VORTEXAI_API_HOST') || DEFAULT_API_HOST).replace(/\/+$/, '');
  const model = readEnv('IMAGE_API_MODEL') || readEnv('VORTEXAI_IMAGE_MODEL') || DEFAULT_IMAGE_MODEL;
  const referenceImageUrl = readEnv('IMAGE_REFERENCE_URL');
  return { apiKey, apiHost, model, referenceImageUrl };
}

function normalizeError(status, bodyText) {
  let message = bodyText || '';
  try {
    const parsed = JSON.parse(bodyText || '{}');
    message =
      parsed?.error?.message ||
      parsed?.message ||
      message;
  } catch {
    // Keep raw body text.
  }
  const normalized = String(message || '').toLowerCase();

  if (status === 401 || normalized.includes('incorrect api key') || normalized.includes('unauthorized')) {
    return '图片服务密钥无效或已过期';
  }
  if (status === 429 || normalized.includes('rate limit') || normalized.includes('quota')) {
    return '图片服务限流或额度不足，请稍后再试';
  }
  if (status === 524 || normalized.includes('timeout')) {
    return '图片服务处理超时，请稍后重试';
  }
  if (status >= 500) {
    return '图片服务暂时不可用，请稍后重试';
  }
  return message || `图片服务请求失败（${status}）`;
}

async function fetchReferenceImage(origin, configuredUrl) {
  const candidates = configuredUrl
    ? [configuredUrl]
    : [`${origin}/clawd-ref.png`, `${origin}/clawd.png`];

  let lastError = null;
  for (const targetUrl of candidates) {
    try {
      const response = await fetch(targetUrl);
      if (!response.ok) {
        lastError = new Error(`reference_image_fetch_failed_${response.status}`);
        continue;
      }
      const contentType = response.headers.get('content-type') || 'image/png';
      const fileData = await response.arrayBuffer();
      return new Blob([fileData], { type: contentType });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('reference_image_fetch_failed');
}

async function callImageEditsApi({ apiHost, apiKey, model, prompt, referenceImageBlob }) {
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('size', DEFAULT_IMAGE_SIZE);
  form.append('image', referenceImageBlob, 'clawd-ref.png');

  return fetch(`${apiHost}/images/edits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  });
}

async function callImageGenerationsApi({ apiHost, apiKey, model, prompt }) {
  return fetch(`${apiHost}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      prompt,
      size: DEFAULT_IMAGE_SIZE
    })
  });
}

function extractImageData(payload) {
  const first = Array.isArray(payload?.data) ? payload.data[0] : null;
  if (!first) return '';
  const b64 = typeof first.b64_json === 'string' ? first.b64_json.trim() : '';
  if (b64) return `data:image/png;base64,${b64}`;
  const url = typeof first.url === 'string' ? first.url.trim() : '';
  return url;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
  if (!prompt) {
    res.status(400).json({ error: 'prompt_required' });
    return;
  }

  const { apiKey, apiHost, model, referenceImageUrl } = getConfig();
  if (!apiKey) {
    res.status(500).json({ error: 'missing_image_api_key' });
    return;
  }

  const forwardedProto = req.headers['x-forwarded-proto'] || 'https';
  const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = `${forwardedProto}://${forwardedHost}`;

  try {
    let upstreamResponse;
    try {
      const referenceImageBlob = await fetchReferenceImage(origin, referenceImageUrl);
      upstreamResponse = await callImageEditsApi({
        apiHost,
        apiKey,
        model,
        prompt,
        referenceImageBlob
      });
    } catch {
      upstreamResponse = await callImageGenerationsApi({
        apiHost,
        apiKey,
        model,
        prompt
      });
    }

    if (!upstreamResponse.ok) {
      const bodyText = await upstreamResponse.text();
      const message = normalizeError(upstreamResponse.status, bodyText);
      res.status(upstreamResponse.status).json({ error: message });
      return;
    }

    const payload = await upstreamResponse.json();
    const imageDataUrl = extractImageData(payload);
    if (!imageDataUrl) {
      res.status(502).json({ error: '图片服务未返回可用图片' });
      return;
    }

    res.status(200).json({ imageDataUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    res.status(500).json({ error: message });
  }
}
