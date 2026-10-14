const Notification = require("../models/Notification");

const createNotification = async ({
    recipient,
    title,
    message,
    type = "System",
    booking = null,
    trip = null,
}) => {
    if (!recipient) {
        return null;
    }

    return Notification.create({
        recipient,
        title,
        message,
        type,
        booking,
        trip,
    });
};

const createNotifications = async (
    recipients,
    data
) => {
    const notifications = recipients
        .filter(Boolean)
        .map((recipient) => ({
            recipient,
            ...data,
        }));

    if (!notifications.length) {
        return [];
    }

    return Notification.insertMany(notifications);
};

module.exports = {
    createNotification,
    createNotifications,
};