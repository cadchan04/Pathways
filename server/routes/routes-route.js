const express = require('express')
const {
  autocompleteLocations,
  validateSuggestionsQuery,
  buildRouteSuggestions
} = require('../services/mock-routes-service')

const router = express.Router()

router.get('/locations/autocomplete', (req, res) => {
  const suggestions = autocompleteLocations(req.query.q || '')
  res.json(suggestions)
})

router.get('/suggestions', (req, res) => {
  const { originId, destinationId, departDate} = req.query

  const validationError = validateSuggestionsQuery({
    originId,
    destinationId,
    departDate
  })

  if (validationError) {
    return res.status(400).json({ error: validationError })
  }

  const routes = buildRouteSuggestions({ originId, destinationId, departDate })

  return res.json({
    search: {
      originId,
      destinationId,
      departDate
    },
    routes
  })
})

module.exports = router
