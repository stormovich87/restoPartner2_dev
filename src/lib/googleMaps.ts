import { loadGoogleMapsScript } from './googleMapsLoader';

interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

interface ReverseGeocodingResult {
  formattedAddress: string;
  components: {
    street?: string;
    city?: string;
    region?: string;
    country?: string;
    postalCode?: string;
  };
}

interface DistanceResult {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
}

interface DirectionsResult {
  routes: google.maps.DirectionsRoute[];
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
}

async function ensureGoogleMapsLoaded(apiKey: string): Promise<void> {
  await loadGoogleMapsScript(apiKey);
  if (!window.google || !window.google.maps) {
    throw new Error('Google Maps API not loaded');
  }
}

export async function geocodeAddress(
  address: string,
  apiKey: string,
  partnerId?: string
): Promise<GeocodingResult | null> {
  try {
    await ensureGoogleMapsLoaded(apiKey);

    const geocoder = new google.maps.Geocoder();

    return new Promise((resolve) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
          const result = results[0];
          const location = result.geometry.location;

          resolve({
            lat: location.lat(),
            lng: location.lng(),
            formattedAddress: result.formatted_address,
          });
        } else {
          console.error('Geocoding failed:', status);
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  apiKey: string,
  partnerId?: string
): Promise<ReverseGeocodingResult | null> {
  try {
    await ensureGoogleMapsLoaded(apiKey);

    const geocoder = new google.maps.Geocoder();
    const location = { lat, lng };

    return new Promise((resolve) => {
      geocoder.geocode({ location }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
          const result = results[0];
          const components: ReverseGeocodingResult['components'] = {};

          result.address_components.forEach((component) => {
            if (component.types.includes('route')) {
              components.street = component.long_name;
            } else if (component.types.includes('locality')) {
              components.city = component.long_name;
            } else if (component.types.includes('administrative_area_level_1')) {
              components.region = component.long_name;
            } else if (component.types.includes('country')) {
              components.country = component.long_name;
            } else if (component.types.includes('postal_code')) {
              components.postalCode = component.long_name;
            }
          });

          resolve({
            formattedAddress: result.formatted_address,
            components,
          });
        } else {
          console.error('Reverse geocoding failed:', status);
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

export async function calculateDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  apiKey: string,
  partnerId?: string
): Promise<DistanceResult | null> {
  try {
    await ensureGoogleMapsLoaded(apiKey);

    const service = new google.maps.DistanceMatrixService();
    const origin = new google.maps.LatLng(originLat, originLng);
    const destination = new google.maps.LatLng(destLat, destLng);

    return new Promise((resolve) => {
      service.getDistanceMatrix(
        {
          origins: [origin],
          destinations: [destination],
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (response, status) => {
          if (status === google.maps.DistanceMatrixStatus.OK && response) {
            const element = response.rows[0].elements[0];

            if (element.status === google.maps.DistanceMatrixElementStatus.OK) {
              const distanceMeters = element.distance.value;
              const durationSeconds = element.duration.value;

              resolve({
                distanceMeters,
                distanceKm: distanceMeters / 1000,
                durationSeconds,
                durationMinutes: Math.round(durationSeconds / 60),
              });
            } else {
              console.error('Distance element status:', element.status);
              resolve(null);
            }
          } else {
            console.error('Distance matrix failed:', status);
            resolve(null);
          }
        }
      );
    });
  } catch (error) {
    console.error('Distance calculation error:', error);
    return null;
  }
}

export async function calculateDistanceByAddress(
  originAddress: string,
  destAddress: string,
  apiKey: string,
  partnerId?: string
): Promise<DistanceResult | null> {
  try {
    const originCoords = await geocodeAddress(originAddress, apiKey, partnerId);
    const destCoords = await geocodeAddress(destAddress, apiKey, partnerId);

    if (!originCoords || !destCoords) {
      return null;
    }

    return calculateDistance(
      originCoords.lat,
      originCoords.lng,
      destCoords.lat,
      destCoords.lng,
      apiKey,
      partnerId
    );
  } catch (error) {
    console.error('Distance by address calculation error:', error);
    return null;
  }
}

export async function getDirections(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  apiKey: string
): Promise<DirectionsResult | null> {
  try {
    await ensureGoogleMapsLoaded(apiKey);

    const directionsService = new google.maps.DirectionsService();
    const origin = new google.maps.LatLng(originLat, originLng);
    const destination = new google.maps.LatLng(destLat, destLng);

    return new Promise((resolve) => {
      directionsService.route(
        {
          origin,
          destination,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            const route = result.routes[0];
            const leg = route.legs[0];

            resolve({
              routes: result.routes,
              distanceMeters: leg.distance?.value || 0,
              distanceKm: (leg.distance?.value || 0) / 1000,
              durationSeconds: leg.duration?.value || 0,
              durationMinutes: Math.round((leg.duration?.value || 0) / 60),
            });
          } else {
            console.error('Directions failed:', status);
            resolve(null);
          }
        }
      );
    });
  } catch (error) {
    console.error('Directions error:', error);
    return null;
  }
}

export async function testGoogleMapsConnection(
  apiKey: string,
  partnerId?: string
): Promise<{ success: boolean; message: string }> {
  try {
    await ensureGoogleMapsLoaded(apiKey);

    const testResult = await geocodeAddress('Moscow, Red Square', apiKey, partnerId);

    if (testResult) {
      return {
        success: true,
        message: 'Google Maps API работает корректно! Все необходимые сервисы доступны.',
      };
    } else {
      return {
        success: false,
        message: 'Не удалось выполнить тестовый запрос геокодирования',
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Ошибка подключения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
    };
  }
}
