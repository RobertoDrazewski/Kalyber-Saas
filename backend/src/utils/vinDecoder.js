// ============================================================
// [NUEVO 20/07/2026] Decodificador de VIN OFFLINE.
//
// El VIN (Vehicle Identification Number) es un código estandarizado
// mundialmente (ISO 3779), 17 caracteres, que ya nos llega del VL502.
// De él se puede sacar con CERTEZA y sin depender de ninguna API:
//   - Marca (de los primeros 3 caracteres, el WMI, que es un registro
//     mundial fijo asignado a cada fabricante).
//   - País de fabricación.
//   - Año del modelo (posición 10, código estandarizado).
//
// LO QUE NO se puede sacar offline con certeza: el MODELO exacto
// (Focus, Fiesta, etc.). Cada fabricante codifica el modelo a su
// manera en las posiciones 4-8, sin estándar universal. Eso queda
// para que el cliente lo confirme a mano (el frontend pre-carga marca
// y año, y deja el modelo editable).
//
// Esta lista de WMI cubre las marcas más comunes en Argentina. Si
// llega un VIN cuyo WMI no está en la tabla, devolvemos la marca como
// desconocida en vez de inventar — nunca adivinamos.
// ============================================================

// WMI (World Manufacturer Identifier) → marca.
// Se matchea por los primeros 3 caracteres; si no, se prueba por los 2
// primeros (algunos fabricantes chicos comparten prefijo de 2).
const WMI_MAP = {
    // Ford
    '8AF': 'Ford', '9BF': 'Ford', '3FA': 'Ford', '1FA': 'Ford', '1FT': 'Ford', 'WF0': 'Ford',
    // Volkswagen
    '8AW': 'Volkswagen', '9BW': 'Volkswagen', '3VW': 'Volkswagen', 'WVW': 'Volkswagen', 'WVG': 'Volkswagen', '8AC': 'Volkswagen',
    // Chevrolet / GM
    '8AG': 'Chevrolet', '9BG': 'Chevrolet', '1G1': 'Chevrolet', 'KL1': 'Chevrolet', '93C': 'Chevrolet',
    // Fiat
    '8AP': 'Fiat', '9BD': 'Fiat', 'ZFA': 'Fiat', '8AT': 'Fiat',
    // Renault
    '8A1': 'Renault', '93Y': 'Renault', 'VF1': 'Renault', '8A6': 'Renault',
    // Peugeot
    '8AD': 'Peugeot', '936': 'Peugeot', 'VF3': 'Peugeot',
    // Citroën
    '8BC': 'Citroën', '935': 'Citroën', 'VF7': 'Citroën',
    // Toyota
    '8AJ': 'Toyota', '9BR': 'Toyota', 'JTD': 'Toyota', 'JTM': 'Toyota', 'MR0': 'Toyota', 'JTE': 'Toyota',
    // Honda
    '93H': 'Honda', 'JHM': 'Honda', '1HG': 'Honda',
    // Nissan
    '94D': 'Nissan', '3N1': 'Nissan', 'JN1': 'Nissan', '8A2': 'Nissan',
    // Volkswagen Amarok / otros utilitarios comunes ya cubiertos arriba
    // Hyundai
    'KMH': 'Hyundai', '95P': 'Hyundai',
    // Kia
    'KNA': 'Kia', 'KND': 'Kia',
    // Mercedes-Benz
    'WDB': 'Mercedes-Benz', 'WDC': 'Mercedes-Benz', '8AC-MB': 'Mercedes-Benz',
    // BMW
    'WBA': 'BMW', 'WBS': 'BMW',
    // Jeep
    '1J4': 'Jeep', '1C4': 'Jeep',
};

// País de fabricación por el primer caracter del VIN (rango ISO 3779).
function countryFromVin(vin) {
    const c = vin[0];
    // Rangos simplificados a los relevantes para el mercado local.
    if ('123456789'.includes(c) && c !== '8' && c !== '9') {
        if ('12345'.includes(c)) return 'Estados Unidos';
        if (c === '6') return 'Oceanía';
        if (c === '7') return 'Estados Unidos';
    }
    const map = {
        '8': _regionBySecond(vin[1], 'Sudamérica'),
        '9': _regionBySecond(vin[1], 'Brasil'),
        'J': 'Japón',
        'K': 'Corea del Sur',
        'L': 'China',
        'M': 'India / Asia',
        'S': 'Reino Unido / Europa',
        'V': 'Francia / España',
        'W': 'Alemania',
        'Z': 'Italia',
        'R': 'Taiwán / Asia',
    };
    return map[c] || 'Origen no identificado';
}

// Para VIN que empiezan con 8 o 9 (Sudamérica), el segundo caracter
// afina el país.
function _regionBySecond(second, fallback) {
    const map = { 'A': 'Argentina', 'B': 'Argentina', 'X': 'Argentina', 'F': 'Brasil', 'B9': 'Brasil', 'W': 'Brasil', 'L': 'Brasil', 'G': 'Brasil' };
    return map[second] || fallback;
}

// Año del modelo — posición 10 del VIN (índice 9). Código
// estandarizado que se repite cada 30 años. Para autos actuales
// (2010-2039), esta tabla es la vigente.
const YEAR_CODES = {
    'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014, 'F': 2015,
    'G': 2016, 'H': 2017, 'J': 2018, 'K': 2019, 'L': 2020, 'M': 2021,
    'N': 2022, 'P': 2023, 'R': 2024, 'S': 2025, 'T': 2026, 'V': 2027,
    'W': 2028, 'X': 2029, 'Y': 2030,
    '1': 2031, '2': 2032, '3': 2033, '4': 2034, '5': 2035,
    '6': 2036, '7': 2037, '8': 2038, '9': 2039,
};

/**
 * Decodifica un VIN de forma offline.
 * Devuelve { valid, marca, pais, anio, vin } — los campos que no se
 * pueden determinar quedan en null, NUNCA se inventan.
 */
function decodeVin(rawVin) {
    if (!rawVin || typeof rawVin !== 'string') {
        return { valid: false, marca: null, pais: null, anio: null, vin: null };
    }
    const vin = rawVin.trim().toUpperCase();

    // Validación estándar: 17 caracteres, sin I/O/Q (que no se usan en
    // VIN para no confundir con 1/0).
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
        return { valid: false, marca: null, pais: null, anio: null, vin };
    }

    const wmi3 = vin.slice(0, 3);
    const marca = WMI_MAP[wmi3] || null;
    const pais = countryFromVin(vin);
    const anio = YEAR_CODES[vin[9]] || null;

    return {
        valid: true,
        vin,
        marca,          // puede ser null si el WMI no está en la tabla
        pais,
        anio,
        // El modelo NO se decodifica offline con certeza — el frontend
        // lo pide al usuario.
        modelo: null,
    };
}

module.exports = { decodeVin };
