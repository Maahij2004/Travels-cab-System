import React from "react";
import { Check, ShieldCheck, Tag } from "lucide-react";

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

export default function RedTaxiFareBreakdown({ fare, distanceKm, vehicleCategory, promoApplied }) {
  if (!fare) return null;
  const baseFare = Number(fare.baseFare || 0);
  const additionalCharges = fare.additionalCharges || fare.charges || {};
  const nightCharge = Number(additionalCharges.night || additionalCharges.nightCharge || fare.nightCharge || 0);
  const tollCharge = Number(additionalCharges.toll || additionalCharges.tollCharge || fare.tollCharge || 0);
  const parkingCharge = Number(additionalCharges.parking || additionalCharges.parkingCharge || fare.parkingCharge || 0);
  const airportCharge = Number(additionalCharges.airport || additionalCharges.airportCharge || fare.airportCharge || 0);
  const permitCharge = Number(additionalCharges.permit || additionalCharges.permitCharge || fare.permitCharge || 0);
  const waitingCharge = Number(additionalCharges.waiting || additionalCharges.waitingCharge || fare.waitingCharge || 0);
  const surgeCharge = Number(fare.surge || fare.surgeCharge || 0);
  const finalTotal = Number(fare.finalFare ?? fare.totalFare ?? baseFare);
  const chargeRows = [
    ["Night charge", nightCharge], ["Toll", tollCharge], ["Parking", parkingCharge], ["Airport charge", airportCharge], ["Permit / state charge", permitCharge], ["Waiting charge", waitingCharge], ["Surge", surgeCharge],
  ].filter(([, value]) => value > 0);

  return (
    <div className="red-taxi-fare-breakdown bg-white rounded-2xl border border-red-100 p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2"><ShieldCheck className="text-red-600" size={20} /><div><h4 className="font-jakarta text-base font-extrabold text-gray-900">Transparent Fare Breakdown</h4><span className="text-[10px] text-gray-500">{vehicleCategory || "Selected vehicle"}{distanceKm ? ` · ${distanceKm} km road distance` : ""}</span></div></div>
        <span className="text-[11px] font-space font-bold bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full">NO HIDDEN CHARGES</span>
      </div>

      <div className="space-y-2 text-xs font-dmsans">
        <div className="flex justify-between text-gray-600"><span>Base fare</span><span className="font-space font-semibold text-gray-900">{money(baseFare)}</span></div>
        {chargeRows.map(([label, value]) => <div className="flex justify-between text-gray-600" key={label}><span>{label}</span><span className="font-space font-semibold text-gray-900">{money(value)}</span></div>)}
        {promoApplied && <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50 p-2 rounded-lg"><span className="flex items-center gap-1"><Tag size={13} /> Coupon applied</span><span className="font-space">Calculated by system</span></div>}
      </div>

      <div className="border-t border-dashed border-gray-200 pt-3 flex items-center justify-between">
        <div><span className="text-xs font-jakarta font-bold text-gray-800 block">Estimated payable fare</span><span className="text-[10px] text-gray-400 flex items-center gap-1"><Check size={11} /> Final fare follows the active admin pricing rules</span></div>
        <div className="font-space text-2xl font-black text-red-600">{money(finalTotal)}</div>
      </div>
    </div>
  );
}
