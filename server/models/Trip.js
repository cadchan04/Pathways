const mongoose = require('mongoose');
const { routeSchema } = require("./Route");

const TripSchema = new mongoose.Schema({
    owner: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    collaboratorIds: [{ type: String }], // will be array of user IDs who are collaborators
    collaborators: [
        {
            userId: { type: String, required: true },
            role: {
                type: String,
                enum: ['viewer', 'editor'],
                required: true,
            },
        },
    ],
    routes: [routeSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    budget: { type: Number },
    totalCost: { type: Number, default: 0 },
    lastKnownCost: { type: Number, default: null },
    priceAlerts: [{
        message: { type: String },
        createdAt: { type: Date, default: Date.now },
        read: { type: Boolean, default: false }
    }],
    editHistory: [
        {
            action: {
                type: String,
                enum: ['trip_updated', 'route_added', 'route_updated', 'route_deleted'],
                required: true,
            },
            summary: { type: String, required: true },
            changedBy: { type: String, required: true },
            changedByName: { type: String },
            changedAt: { type: Date, default: Date.now },
            changes: [
                {
                    field: { type: String },
                    label: { type: String },
                    previousValue: { type: String },
                    newValue: { type: String },
                }
            ],
        }
    ],
    packingList: [
        {
          id: { type: String, required: true },
          text: { type: String, required: true },
          checked: { type: Boolean, default: false }
        }
    ]
});

TripSchema.index({ 'collaborators.userId': 1 });
TripSchema.index({ collaboratorIds: 1 });

// calculate total cost from routes
TripSchema.pre('save', async function() {
    if (this.routes && this.routes.length > 0) {
        this.totalCost = this.routes.reduce((sum, route) => {
            return sum + (Number(route.totalCost) || 0);
        }, 0);
    } else {
        this.totalCost = 0;
    }
});

const Trip = mongoose.model('Trip', TripSchema);

module.exports = Trip;
