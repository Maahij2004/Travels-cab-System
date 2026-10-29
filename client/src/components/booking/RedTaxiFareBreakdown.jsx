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
    <div className="red-taxi-fare-breakdown">
      <div className="red-taxi-fare-head">
        <div className="red-taxi-fare-title"><ShieldCheck className="text-red-600" size={20} /><div><h4 className="red-taxi-fare-title-text">Transparent Fare Breakdown</h4><span className="red-taxi-fare-subtitle">{vehicleCategory || "Selected vehicle"}{distanceKm ? ` · ${distanceKm} km road distance` : ""}</span></div></div>
        <span className="red-taxi-fare-badge">NO HIDDEN CHARGES</span>
      </div>

      <div className="red-taxi-fare-rows">
        <div className="red-taxi-fare-row"><span>Base fare</span><span className="red-taxi-fare-row-value">{money(baseFare)}</span></div>
        {chargeRows.map(([label, value]) => <div className="red-taxi-fare-row" key={label}><span>{label}</span><span className="red-taxi-fare-row-value">{money(value)}</span></div>)}
        {promoApplied && <div className="red-taxi-fare-coupon"><span className="red-taxi-fare-coupon-label"><Tag size={13} /> Coupon applied</span><span className="red-taxi-fare-coupon-value">Calculated by system</span></div>}
      </div>

      <div className="red-taxi-fare-total">
        <div><span className="red-taxi-fare-total-label">Estimated payable fare</span><span className="red-taxi-fare-note"><Check size={11} /> Final fare follows the active admin pricing rules</span></div>
        <div className="red-taxi-fare-amount">{money(finalTotal)}</div>
      </div>
    </div>
  );
}
