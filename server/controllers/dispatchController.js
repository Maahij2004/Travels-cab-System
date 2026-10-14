const {
  startDispatch,
  acceptOffer,
  declineOffer,
  getMyActiveOffer,
} = require("../services/dispatchService");

const startBookingDispatch = async (req, res) => {
  try {
    const offer = await startDispatch(req.params.bookingId);
    res.json({ success: true, offer, message: offer ? "Ride request sent to the nearest eligible driver" : "No eligible driver is available yet; dispatch will keep trying" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getDriverOffer = async (req, res) => {
  try {
    const offer = await getMyActiveOffer(req.user._id);
    res.json({ success: true, offer });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const acceptDriverOffer = async (req, res) => {
  try {
    const result = await acceptOffer(req.params.offerId, req.user._id);
    res.json({ success: true, message: "Ride accepted successfully", ...result });
  } catch (error) {
    res.status(409).json({ success: false, message: error.message });
  }
};

const declineDriverOffer = async (req, res) => {
  try {
    const nextOffer = await declineOffer(req.params.offerId, req.user._id, req.body?.reason || "Driver declined");
    res.json({ success: true, message: "Ride declined. Searching for the next nearby driver.", nextOffer });
  } catch (error) {
    res.status(409).json({ success: false, message: error.message });
  }
};

module.exports = { startBookingDispatch, getDriverOffer, acceptDriverOffer, declineDriverOffer };
