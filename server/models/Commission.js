const mongoose = require("mongoose");

const commissionSchema = new mongoose.Schema(
    {
        driver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Driver",
            required: true,
            unique: true,
        },

        commissionType: {
            type: String,
            enum: ["Fixed", "Percentage"],
            default: "Fixed",
        },

        commissionValue: {
            type: Number,
            required: true,
            min: 0,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        effectiveFrom: {
            type: Date,
            default: Date.now,
        },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports =
    mongoose.models.Commission ||
    mongoose.model("Commission", commissionSchema);