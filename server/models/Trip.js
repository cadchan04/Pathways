const mongoose = require('mongoose');
const { routeSchema } = require("./Route");

const collabNotificationSchema = new mongoose.Schema(
    {
        actorUserId: { type: String, required: true },
        recipientUserId: { type: String, required: true },
        type: {
            type: String,
            enum: [
                'trip_updated',
                'route_added',
                'route_updated',
                'route_deleted',
                'accommodation_added',
                'accommodation_deleted',
                'activity_added',
                'activity_updated',
                'activity_deleted',
                'collaborator_added',
                'collaborator_removed',
                'itinerary_option_added',
                'itinerary_option_updated',
                'itinerary_option_deleted',
                'itinerary_option_reviewed',
                'itinerary_option_commented'
            ],
            required: true
        },
        message: { type: String, required: true, trim: true },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
        read: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now }
    },
    { _id: true }
);

const itineraryReviewSchema = new mongoose.Schema(
    {
        userId: { type: String, required: true },
        value: {
            type: String,
            enum: ['preferred', 'acceptable', 'not_preferred'],
            required: true,
        },
        comment: { type: String, trim: true, default: '' },
        userLabel: { type: String, trim: true, default: '' },
    },
    { _id: true, timestamps: true }
);

const itineraryOptionCommentSchema = new mongoose.Schema(
    {
        userId: { type: String, required: true },
        comment: { type: String, required: true, trim: true },
        userLabel: { type: String, trim: true, default: '' },
    },
    { _id: true, timestamps: true }
);

const itineraryOptionItemSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ['route', 'accommodation', 'activity', 'custom'],
            required: true,
        },
        refId: { type: String, default: null },
        label: { type: String, required: true, trim: true },
        date: { type: Date, default: null },
        cost: { type: Number, default: null },
        notes: { type: String, trim: true, default: '' },
    },
    { _id: true }
);

const itineraryOptionSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        summary: { type: String, trim: true, default: '' },
        proposedByUserId: { type: String, required: true },
        status: {
            type: String,
            enum: ['draft', 'proposed', 'archived'],
            default: 'draft',
        },
        items: { type: [itineraryOptionItemSchema], default: [] },
        estimatedTotalCost: { type: Number, default: 0 },
        reviews: { type: [itineraryReviewSchema], default: [] },
        comments: { type: [itineraryOptionCommentSchema], default: [] },
    },
    { _id: true, timestamps: true }
);

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
    collabAlerts: [collabNotificationSchema],
    packingList: [
        {
          id: { type: String, required: true },
          text: { type: String, required: true },
          checked: { type: Boolean, default: false }
        }
    ],
    itineraryOptions: { type: [itineraryOptionSchema], default: [] }
});

TripSchema.index({ 'collaborators.userId': 1 });
TripSchema.index({ collaboratorIds: 1 });
TripSchema.index({ 'collabAlerts.recipientUserId': 1, 'collabAlerts.read': 1, 'collabAlerts.createdAt': -1 });

// calculate total cost from routes
// Recalculate at the save bc now there are activities and accommodations that also contribute to total cost, so we can't just sum the routes
// TripSchema.pre('save', async function() {
//     if (this.routes && this.routes.length > 0) {
//         this.totalCost = this.routes.reduce((sum, route) => {
//             return sum + (Number(route.totalCost) || 0);
//         }, 0);
//     } else {
//         this.totalCost = 0;
//     }
// });

const Trip = mongoose.model('Trip', TripSchema);

module.exports = Trip;