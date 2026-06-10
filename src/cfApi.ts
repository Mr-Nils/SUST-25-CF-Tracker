// Client-side Codeforces API helper utilizing JSONP to bypass CORS & Server Cloudflare limits safely.
let callbackCounter = 0;

/**
 * Executes a Codeforces API query using JSONP.
 * Codeforces API natively supports JSONP via the `jsonp` query parameter.
 * This completely circumvents browser CORS errors while running on the user's local IP (avoiding server-side Cloudflare blocks).
 */
export function fetchCFViaJsonp(apiMethod: string, params: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const callbackName = `_cf_api_callback_${Date.now()}_${callbackCounter++}`;
    
    // Set up global callback handler
    (window as any)[callbackName] = (response: any) => {
      cleanup();
      if (response && response.status === "OK") {
        resolve(response.result);
      } else {
        reject(new Error(response?.comment || `Codeforces API returned status: ${response?.status || "FAILED"}`));
      }
    };

    // Build URL with query parameters including the jsonp callback name
    const queryParams = new URLSearchParams(params);
    queryParams.set("jsonp", callbackName);
    const url = `https://codeforces.com/api/${apiMethod}?${queryParams.toString()}`;

    // Create script element
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.id = callbackName;

    // Timeout fallback (11 seconds)
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Codeforces API timeout after waiting for callback "${callbackName}".`));
    }, 11000);

    // Error event handler
    script.onerror = () => {
      cleanup();
      reject(new Error(`Codeforces script failed to load for "${apiMethod}". This may indicate Codeforces is down or the parameters are incorrect.`));
    };

    function cleanup() {
      clearTimeout(timeoutId);
      const scriptElement = document.getElementById(callbackName);
      if (scriptElement) {
        scriptElement.remove();
      }
      delete (window as any)[callbackName];
    }

    // Append script to DOM to fire request
    document.body.appendChild(script);
  });
}

/**
 * Fetch profiles for a batch of handles using JSONP
 */
export async function cfGetUserInfo(handles: string[]): Promise<any[]> {
  if (handles.length === 0) return [];
  // Ensure we don't pass empty elements or duplicates
  const cleanHandles = Array.from(new Set(handles.map(h => h.trim()).filter(Boolean)));
  if (cleanHandles.length === 0) return [];

  // Codeforces limits handles parameter
  return fetchCFViaJsonp("user.info", { handles: cleanHandles.join(";") });
}

/**
 * Fetch submission history for a single handle
 */
export async function cfGetUserStatus(handle: string): Promise<any[]> {
  return fetchCFViaJsonp("user.status", { handle: handle.trim() });
}

/**
 * Fetch contest rating history for a single handle
 */
export async function cfGetUserRating(handle: string): Promise<any[]> {
  return fetchCFViaJsonp("user.rating", { handle: handle.trim() });
}
