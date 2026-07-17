// ============================================================
// Geocodificación inversa: convierte lat/lng en "Calle 1234,
// Barrio/Ciudad" para mostrar en el panel en vez de solo números.
//
// Usa Nominatim (OpenStreetMap) — es gratis y no requiere API key ni
// facturación, a diferencia de la API de Google. Trade-off honesto:
// la calidad de los nombres de calle en Mendoza es buena pero no
// perfecta (depende de qué tan completo esté el mapeo colaborativo de
// OSM en esa zona puntual) — si el día de mañana hace falta más
// precisión, se puede reemplazar este archivo por la API de Google
// Geocoding sin tocar el resto del código (misma firma de función).
//
// CACHÉ: como TabPosicion consulta cada 5 segundos y un auto
// estacionado no cambia de calle, cacheamos por celda de grilla
// (~11 metros) para no mandar un pedido nuevo por cada actualización
// — esto también respeta el límite de uso de Nominatim (máx. 1
// pedido/segundo).
// ============================================================

const cache = new Map();
const CACHE_MAX_SIZE = 500;

function gridKey(lat, lng) {
  // 4 decimales ≈ 11 metros de resolución — autos en el mismo lugar
  // (estacionados) comparten la misma celda y no vuelven a pedir.
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/**
 * Devuelve una dirección corta tipo "San Martín 1234, Godoy Cruz" a
 * partir de lat/lng. Devuelve null si falla (el que llama debe seguir
 * mostrando lat/lng como respaldo, nunca dejar la pantalla en blanco).
 */
export async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null) return null;
  const key = gridKey(lat, lng);

  if (cache.has(key)) return cache.get(key);

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'es' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};

    const street = a.road || a.pedestrian || a.residential || null;
    const number = a.house_number || null;
    const locality = a.city || a.town || a.village || a.suburb || a.county || null;

    if (!street) {
      cache.set(key, null);
      return null;
    }

    const short = number ? `${street} ${number}` : street;
    const full = locality ? `${short}, ${locality}` : short;

    const result = { short, full, street, number, locality };

    if (cache.size >= CACHE_MAX_SIZE) {
      // Grilla simple LRU-ish: borra la entrada más vieja (la primera
      // en orden de inserción de un Map) para no crecer sin límite en
      // una sesión larga con muchos vehículos.
      cache.delete(cache.keys().next().value);
    }
    cache.set(key, result);
    return result;
  } catch {
    return null; // sin conexión, rate-limit, etc. — el que llama sigue con lat/lng
  }
}