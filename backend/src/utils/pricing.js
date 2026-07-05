// ============================================================
// Fuente única de verdad para precios y descuentos.
//
// IMPORTANTE: nunca confiar en montos que llegan del navegador
// (req.body.monto_mensual, etc.) — siempre recalcular acá con
// el plan + la cantidad que mandó el cliente, y listo. Así, si
// alguien intercepta el request y manda "monto: 0.01", el backend
// lo ignora y cobra lo que corresponde según el plan real.
// ============================================================

const PLAN_INFO = {
    basico: { label: 'Plan Básico (JM-VL04)', monthly: 30, hardware: 110 },
    avanzado: { label: 'Plan Avanzado (JM-VL502)', monthly: 60, hardware: 130 },
};

function calcDiscount(vehicleCount) {
    if (vehicleCount >= 50) return 20;
    if (vehicleCount >= 10) return 10;
    return 0;
}

// Valida plan + cantidad y devuelve todos los totales ya calculados
// server-side. Tira un Error con mensaje legible si algo es inválido,
// para que el controller solo tenga que hacer try/catch.
function calcQuote(plan, vehicleCount) {
    const info = PLAN_INFO[plan];
    if (!info) {
        throw new Error('Plan inválido');
    }
    const qty = parseInt(vehicleCount, 10);
    if (!qty || qty < 1 || qty > 10000) {
        throw new Error('Cantidad de vehículos inválida');
    }
    const discountPct = calcDiscount(qty);
    const monthlyTotal = Number((info.monthly * qty * (1 - discountPct / 100)).toFixed(2));
    const hardwareTotal = Number((info.hardware * qty).toFixed(2));

    return { info, qty, discountPct, monthlyTotal, hardwareTotal };
}

module.exports = { PLAN_INFO, calcDiscount, calcQuote };
