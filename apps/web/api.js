export async function api(path, data) {
  const response = await fetch(`/api${path}`, { method: data === undefined ? 'GET' : 'POST',
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) { const error = new Error(result.error); error.status = response.status; throw error; }
  return result;
}
