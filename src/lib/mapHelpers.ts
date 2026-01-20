import { loadGoogleMapsScript } from './googleMapsLoader';
import { supabase } from './supabase';

export interface RouteInfo {
  distance: string;
  duration: string;
}

export interface Branch {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export const ensureBranchCoordinates = async (
  branchId: string,
  branches: Branch[],
  googleMapsApiKey: string,
  onUpdate?: (branches: Branch[]) => void
): Promise<{ latitude: number; longitude: number } | null> => {
  const branch = branches.find(b => b.id === branchId);
  if (!branch) return null;

  if (branch.latitude && branch.longitude) {
    return { latitude: branch.latitude, longitude: branch.longitude };
  }

  if (!branch.address || !googleMapsApiKey) {
    return null;
  }

  try {
    await loadGoogleMapsScript(googleMapsApiKey);
    const geocoder = new google.maps.Geocoder();

    return new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
      geocoder.geocode({ address: branch.address }, async (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
          const location = results[0].geometry.location;
          const latitude = location.lat();
          const longitude = location.lng();

          const { error } = await supabase
            .from('branches')
            .update({ latitude, longitude })
            .eq('id', branchId);

          if (!error && onUpdate) {
            const updatedBranches = branches.map(b =>
              b.id === branchId
                ? { ...b, latitude, longitude }
                : b
            );
            onUpdate(updatedBranches);
            resolve({ latitude, longitude });
          } else {
            console.error('Error saving branch coordinates:', error);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error('Geocoding branch address error:', error);
    return null;
  }
};

export const calculateRouteDistance = async (
  branchLat: number,
  branchLng: number,
  deliveryLat: number,
  deliveryLng: number,
  googleMapsApiKey: string
): Promise<RouteInfo | null> => {
  try {
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';

    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: branchLat,
            longitude: branchLng,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: deliveryLat,
            longitude: deliveryLng,
          },
        },
      },
      travelMode: 'DRIVE',
      computeAlternativeRoutes: false,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleMapsApiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error('Routes API request failed:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const distanceMeters = route.distanceMeters || 0;
      const durationSeconds = parseInt(route.duration?.replace('s', '') || '0', 10);

      const distanceKm = (distanceMeters / 1000).toFixed(1);
      const durationMinutes = Math.round(durationSeconds / 60);

      return {
        distance: `${distanceKm} км`,
        duration: `${durationMinutes} мин`,
      };
    }

    console.error('No routes found in response');
    return null;
  } catch (error) {
    console.error('Route calculation error:', error);
    return null;
  }
};

export const geocodeAddress = async (
  address: string,
  googleMapsApiKey: string
): Promise<{ lat: number; lng: number; formattedAddress: string } | null> => {
  try {
    await loadGoogleMapsScript(googleMapsApiKey);
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
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

export const reverseGeocode = async (
  lat: number,
  lng: number,
  googleMapsApiKey: string
): Promise<string | null> => {
  try {
    await loadGoogleMapsScript(googleMapsApiKey);
    const geocoder = new google.maps.Geocoder();
    const location = { lat, lng };

    return new Promise((resolve) => {
      geocoder.geocode({ location }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
          resolve(results[0].formatted_address);
        } else {
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
};

export interface BranchWithDistance extends Branch {
  routeInfo?: RouteInfo;
  distanceValue?: number;
}

export const findNearestBranch = async (
  branches: Branch[],
  deliveryLat: number,
  deliveryLng: number,
  googleMapsApiKey: string
): Promise<{ nearestBranch: BranchWithDistance | null; allBranchesWithDistance: BranchWithDistance[] }> => {
  try {
    const branchesWithCoords = branches.filter(b => b.latitude && b.longitude);

    if (branchesWithCoords.length === 0) {
      return { nearestBranch: null, allBranchesWithDistance: [] };
    }

    const routePromises = branchesWithCoords.map(async (branch) => {
      const routeInfo = await calculateRouteDistance(
        branch.latitude!,
        branch.longitude!,
        deliveryLat,
        deliveryLng,
        googleMapsApiKey
      );

      if (routeInfo) {
        const distanceValue = parseFloat(routeInfo.distance.replace(' км', '').replace(',', '.')) * 1000;
        return {
          ...branch,
          routeInfo,
          distanceValue,
        };
      }

      return { ...branch };
    });

    const branchesWithDistance = await Promise.all(routePromises);
    const validBranches = branchesWithDistance.filter(b => b.distanceValue !== undefined);
    const nearestBranch = validBranches.length > 0
      ? validBranches.reduce((nearest, current) =>
          (current.distanceValue! < nearest.distanceValue! ? current : nearest)
        )
      : null;

    return { nearestBranch, allBranchesWithDistance: branchesWithDistance };
  } catch (error) {
    console.error('Error finding nearest branch:', error);
    return { nearestBranch: null, allBranchesWithDistance: [] };
  }
};
