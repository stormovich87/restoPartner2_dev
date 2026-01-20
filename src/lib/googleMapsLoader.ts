let isLoading = false;
let isLoaded = false;
let loadPromise: Promise<void> | null = null;
let currentApiKey: string | null = null;

const CALLBACK_NAME = '__googleMapsCallback__';

export async function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (isLoaded && currentApiKey === apiKey) {
    return Promise.resolve();
  }

  if (isLoading && loadPromise) {
    return loadPromise;
  }

  if (currentApiKey && currentApiKey !== apiKey) {
    const existingScript = document.querySelector(
      `script[src*="maps.googleapis.com/maps/api/js"]`
    );
    if (existingScript) {
      existingScript.remove();
    }
    isLoaded = false;
    currentApiKey = null;
    delete (window as any).google;
  }

  isLoading = true;

  loadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Google Maps can only be loaded in browser environment'));
      return;
    }

    if (window.google && window.google.maps && currentApiKey === apiKey) {
      isLoaded = true;
      isLoading = false;
      resolve();
      return;
    }

    (window as any)[CALLBACK_NAME] = () => {
      isLoaded = true;
      isLoading = false;
      currentApiKey = apiKey;
      resolve();
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async&callback=${CALLBACK_NAME}`;
    script.async = true;
    script.defer = true;

    script.onerror = () => {
      isLoading = false;
      loadPromise = null;
      reject(new Error('Failed to load Google Maps API. Check API key and HTTP referrer restrictions.'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

export function isGoogleMapsLoaded(): boolean {
  return isLoaded && typeof window !== 'undefined' && window.google && window.google.maps;
}

export function resetGoogleMapsLoader(): void {
  isLoading = false;
  isLoaded = false;
  loadPromise = null;
  currentApiKey = null;
}

declare global {
  interface Window {
    google: typeof google;
  }
}
