const Booking = require("../models/booking");
const Driver = require("../models/driver");
const Vehicle = require("../models/Vehicle");
const VehicleCategory = require("../models/VehicleCategory");

const {
    createTripFromBooking,
} = require("./tripService");

/*
|--------------------------------------------------------------------------
| AUTO ASSIGN DRIVER + VEHICLE
|--------------------------------------------------------------------------
*/

const assignDriverAndVehicle = async (bookingId) => {
    const booking = await Booking.findById(bookingId);

    if (!booking) {
        throw new Error("Booking not found");
    }

    // Only these booking states can receive assignment
    if (!["Pending", "Confirmed"].includes(booking.status)) {
        throw new Error(
            `Booking cannot be assigned in ${booking.status} status`
        );
    }

    // Get vehicle category
    const category = await VehicleCategory.findById(
        booking.vehicleCategory
    );

    if (!category) {
        throw new Error("Vehicle category not found");
    }

    if (!category.isActive) {
        throw new Error("Vehicle category is inactive");
    }

    /*
    |--------------------------------------------------------------------------
    | FIND AVAILABLE VEHICLE
    |--------------------------------------------------------------------------
    */

    const vehicle = await Vehicle.findOne({
        category: category._id,
        availability: true,
        status: "Available",
        seatingCapacity: {
            $gte: booking.passengerCount,
        },
    }).sort({ createdAt: 1 });

    if (!vehicle) {
        throw new Error(
            "No available vehicle found for this booking"
        );
    }

    /*
    |--------------------------------------------------------------------------
    | FIND AVAILABLE DRIVER
    |--------------------------------------------------------------------------
    */

    const driver = await Driver.findOne({
        availability: true,
        status: "Available",
        isActive: true,
    }).sort({ createdAt: 1 });

    if (!driver) {
        throw new Error(
            "No available driver found for this booking"
        );
    }

    /*
    |--------------------------------------------------------------------------
    | ASSIGN VEHICLE
    |--------------------------------------------------------------------------
    */

    vehicle.status = "Assigned";
    vehicle.availability = false;

    await vehicle.save();

    /*
    |--------------------------------------------------------------------------
    | ASSIGN DRIVER
    |--------------------------------------------------------------------------
    */

    driver.status = "Assigned";
    driver.availability = false;
    driver.assignedVehicle = vehicle._id;

    await driver.save();

    /*
    |--------------------------------------------------------------------------
    | UPDATE BOOKING
    |--------------------------------------------------------------------------
    */

    booking.assignedVehicle = vehicle._id;
    booking.assignedDriver = driver._id;
    booking.status = "Trip Scheduled";

    await booking.save();

    /*
    |--------------------------------------------------------------------------
    | CREATE TRIP AUTOMATICALLY
    |--------------------------------------------------------------------------
    */

    let trip;

    try {
        trip = await createTripFromBooking(booking._id);
    } catch (error) {
        /*
        If trip creation fails, rollback assignment.
        This prevents a driver/vehicle from becoming stuck.
        */

        vehicle.status = "Available";
        vehicle.availability = true;
        await vehicle.save();

        driver.status = "Available";
        driver.availability = true;
        driver.assignedVehicle = null;
        await driver.save();

        booking.assignedVehicle = null;
        booking.assignedDriver = null;
        booking.status = "Confirmed";

        await booking.save();

        throw error;
    }

    return {
        booking,
        driver,
        vehicle,
        trip,
    };
};


/*
|--------------------------------------------------------------------------
| MANUAL ASSIGN DRIVER + VEHICLE
|--------------------------------------------------------------------------
*/

const manuallyAssignDriverAndVehicle = async (
    bookingId,
    driverId,
    vehicleId
) => {
    const booking = await Booking.findById(bookingId);

    if (!booking) {
        throw new Error("Booking not found");
    }

    if (!["Pending", "Confirmed"].includes(booking.status)) {
        throw new Error(
            `Booking cannot be assigned in ${booking.status} status`
        );
    }

    const category = await VehicleCategory.findById(
        booking.vehicleCategory
    );

    if (!category) {
        throw new Error("Vehicle category not found");
    }

    /*
    |--------------------------------------------------------------------------
    | FIND DRIVER
    |--------------------------------------------------------------------------
    */

    const driver = await Driver.findById(driverId);

    if (!driver) {
        throw new Error("Driver not found");
    }

    if (!driver.isActive) {
        throw new Error("Driver account is inactive");
    }

    if (!driver.availability || driver.status !== "Available") {
        throw new Error("Driver is not available");
    }

    /*
    |--------------------------------------------------------------------------
    | FIND VEHICLE
    |--------------------------------------------------------------------------
    */

    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
        throw new Error("Vehicle not found");
    }

    if (!vehicle.availability || vehicle.status !== "Available") {
        throw new Error("Vehicle is not available");
    }

    /*
    |--------------------------------------------------------------------------
    | CATEGORY VALIDATION
    |--------------------------------------------------------------------------
    */

    if (
        vehicle.category.toString() !==
        category._id.toString()
    ) {
        throw new Error(
            "Selected vehicle does not belong to the booking vehicle category"
        );
    }

    /*
    |--------------------------------------------------------------------------
    | SEATING VALIDATION
    |--------------------------------------------------------------------------
    */

    if (
        vehicle.seatingCapacity <
        booking.passengerCount
    ) {
        throw new Error(
            `Vehicle seating capacity is insufficient. Required: ${booking.passengerCount}, Available: ${vehicle.seatingCapacity}`
        );
    }

    /*
    |--------------------------------------------------------------------------
    | ASSIGN VEHICLE
    |--------------------------------------------------------------------------
    */

    vehicle.status = "Assigned";
    vehicle.availability = false;

    await vehicle.save();

    /*
    |--------------------------------------------------------------------------
    | ASSIGN DRIVER
    |--------------------------------------------------------------------------
    */

    driver.status = "Assigned";
    driver.availability = false;
    driver.assignedVehicle = vehicle._id;

    await driver.save();

    /*
    |--------------------------------------------------------------------------
    | UPDATE BOOKING
    |--------------------------------------------------------------------------
    */

    booking.assignedDriver = driver._id;
    booking.assignedVehicle = vehicle._id;
    booking.status = "Trip Scheduled";

    await booking.save();

    /*
    |--------------------------------------------------------------------------
    | CREATE TRIP
    |--------------------------------------------------------------------------
    */

    let trip;

    try {
        trip = await createTripFromBooking(booking._id);
    } catch (error) {
        /*
        Rollback if Trip creation fails
        */

        vehicle.status = "Available";
        vehicle.availability = true;

        await vehicle.save();

        driver.status = "Available";
        driver.availability = true;
        driver.assignedVehicle = null;

        await driver.save();

        booking.assignedDriver = null;
        booking.assignedVehicle = null;
        booking.status = "Confirmed";

        await booking.save();

        throw error;
    }

    return {
        booking,
        driver,
        vehicle,
        trip,
    };
};


/*
|--------------------------------------------------------------------------
| RELEASE ASSIGNMENT
|--------------------------------------------------------------------------
*/

const releaseAssignment = async (bookingId) => {
    const booking = await Booking.findById(bookingId);

    if (!booking) {
        throw new Error("Booking not found");
    }

    /*
    |--------------------------------------------------------------------------
    | RELEASE DRIVER
    |--------------------------------------------------------------------------
    */

    if (booking.assignedDriver) {
        const driver = await Driver.findById(
            booking.assignedDriver
        );

        if (driver) {
            driver.status = "Available";
            driver.availability = true;
            driver.assignedVehicle = null;

            await driver.save();
        }
    }

    /*
    |--------------------------------------------------------------------------
    | RELEASE VEHICLE
    |--------------------------------------------------------------------------
    */

    if (booking.assignedVehicle) {
        const vehicle = await Vehicle.findById(
            booking.assignedVehicle
        );

        if (vehicle) {
            vehicle.status = "Available";
            vehicle.availability = true;

            await vehicle.save();
        }
    }

    /*
    |--------------------------------------------------------------------------
    | CLEAR BOOKING ASSIGNMENT
    |--------------------------------------------------------------------------
    */

    booking.assignedDriver = null;
    booking.assignedVehicle = null;

    if (booking.status !== "Cancelled") {
        booking.status = "Confirmed";
    }

    await booking.save();

    return booking;
};


/*
|--------------------------------------------------------------------------
| GET CURRENT ASSIGNMENT
|--------------------------------------------------------------------------
*/

const getAssignment = async (bookingId) => {
    const booking = await Booking.findById(bookingId)
        .populate("assignedDriver")
        .populate("assignedVehicle")
        .populate("vehicleCategory");

    if (!booking) {
        throw new Error("Booking not found");
    }

    return {
        bookingId: booking.bookingId,
        status: booking.status,
        driver: booking.assignedDriver || null,
        vehicle: booking.assignedVehicle || null,
        vehicleCategory: booking.vehicleCategory || null,
    };
};


module.exports = {
    assignDriverAndVehicle,
    manuallyAssignDriverAndVehicle,
    releaseAssignment,
    getAssignment,
};