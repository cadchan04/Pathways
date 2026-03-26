const mongoose = require('mongoose');
const { routeSchema } = require("./Route");

const TripSchema = new mongoose.Schema({
    owner: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    collaboratorIds: [{ type: String }], // will be array of user IDs who are collaborators
    routes: [routeSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    budget: { type: Number },
    totalCost: { type: Number, default: 0 }
});

const Trip = mongoose.model('Trip', TripSchema);

// calculate total cost from routes
TripSchema.pre('save', function(next) {
    if (this.routes && this.routes.length > 0) {
        this.totalCost = this.routes.reduce((sum, route) => {
            return sum + (Number(route.totalCost) || 0);
        }, 0);
    } else {
        this.totalCost = 0;
    }
    next();
});

module.exports = Trip;