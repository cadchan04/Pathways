import { describe, expect, test } from 'vitest'

import {
  applyRouteFilters,
  getComparisonWinner,
  getCostFilterError,
  getRouteCostText,
  getRouteModeSummary,
  getRouteProviderSummary,
  getDistanceFilterError,
  getRouteStopCount,
  getStopsFilterError,
  getTravelTimeFilterError
} from './routeUtils.js'

const routes = [
  {
    id: 'short',
    totalDuration: 90,
    totalCost: 45,
    totalDistance: 80,
    localizedFare: '$45',
    legs: [{ segments: [], transportationMode: 'Train', provider: 'Amtrak' }]
  },
  {
    id: 'medium',
    totalDuration: 180,
    totalCost: 120,
    totalDistance: 220,
    legs: [{ segments: [{}, {}], transportationMode: 'Bus', provider: 'Greyhound' }]
  },
  {
    id: 'long',
    totalDuration: 300,
    totalCost: 240,
    totalDistance: 410,
    legs: [
      { segments: [{}, {}], transportationMode: 'Train', provider: 'Amtrak' },
      { segments: [{}, {}], transportationMode: 'Flight', provider: 'Delta' },
      { segments: [], transportationMode: 'Flight', provider: 'Delta' }
    ]
  }
]

describe('applyRouteFilters', () => {
  test('returns all routes with no bounds', () => {
    expect(applyRouteFilters(routes, { travelTime: { min: '', max: '' } })).toEqual(routes)
  })

  test('filters by min travel time', () => {
    expect(applyRouteFilters(routes, { travelTime: { min: '180', max: '' } }).map((route) => route.id)).toEqual(['medium', 'long'])
  })

  test('filters by max travel time', () => {
    expect(applyRouteFilters(routes, { travelTime: { min: '', max: '180' } }).map((route) => route.id)).toEqual(['short', 'medium'])
  })

  test('filters by travel time range', () => {
    expect(applyRouteFilters(routes, { travelTime: { min: '100', max: '250' } }).map((route) => route.id)).toEqual(['medium'])
  })

  test('includes travel time boundaries', () => {
    expect(applyRouteFilters(routes, { travelTime: { min: '90', max: '300' } })).toEqual(routes)
  })

  test('returns no matches for empty range', () => {
    expect(applyRouteFilters(routes, { travelTime: { min: '301', max: '400' } })).toEqual([])
  })

  test('returns no routes for invalid travel time', () => {
    expect(applyRouteFilters(routes, { travelTime: { min: '250', max: '100' } })).toEqual([])
  })

  test('filters by cost range', () => {
    expect(applyRouteFilters(routes, { cost: { min: '50', max: '150' } }).map((route) => route.id)).toEqual(['medium'])
  })

  test('filters by distance range', () => {
    expect(applyRouteFilters(routes, { distance: { min: '100', max: '300' } }).map((route) => route.id)).toEqual(['medium'])
  })

  test('filters by stops range', () => {
    expect(applyRouteFilters(routes, { stops: { min: '1', max: '2' } }).map((route) => route.id)).toEqual(['medium'])
  })

  test('combines all filters', () => {
    expect(
      applyRouteFilters(routes, {
        travelTime: { min: '150', max: '320' },
        cost: { min: '100', max: '200' },
        distance: { min: '200', max: '250' },
        stops: { min: '1', max: '1' }
      }).map((route) => route.id)
    ).toEqual(['medium'])
  })

  test('returns no routes for any invalid range', () => {
    expect(
      applyRouteFilters(routes, {
        travelTime: { min: '', max: '' },
        cost: { min: '200', max: '100' }
      })
    ).toEqual([])
  })
})

describe('filter errors', () => {
  test('travel time error', () => {
    expect(getTravelTimeFilterError({ min: '250', max: '100' })).toBe('Minimum travel time cannot be greater than maximum travel time.')
  })

  test('cost error', () => {
    expect(getCostFilterError({ min: '200', max: '100' })).toBe('Minimum cost cannot be greater than maximum cost.')
  })

  test('distance error', () => {
    expect(getDistanceFilterError({ min: '300', max: '100' })).toBe('Minimum distance cannot be greater than maximum distance.')
  })

  test('stops error', () => {
    expect(getStopsFilterError({ min: '3', max: '1' })).toBe('Minimum stops cannot be greater than maximum stops.')
  })
})

describe('route summaries', () => {
  test('counts stops', () => {
    expect(getRouteStopCount(routes[0])).toBe(0)
    expect(getRouteStopCount(routes[1])).toBe(1)
    expect(getRouteStopCount(routes[2])).toBe(4)
  })

  test('summarizes modes', () => {
    expect(getRouteModeSummary(routes[0])).toBe('Train')
    expect(getRouteModeSummary(routes[2])).toBe('Train → Flight')
  })

  test('summarizes providers', () => {
    expect(getRouteProviderSummary(routes[0])).toBe('Amtrak')
    expect(getRouteProviderSummary(routes[2])).toBe('Amtrak, ... , Delta')
  })

  test('formats cost text', () => {
    expect(getRouteCostText(routes[0])).toBe('$45')
    expect(getRouteCostText(routes[1])).toBe('Estimated Cost: $120')
    expect(getRouteCostText({})).toBe('Fare Not Available')
  })

  test('picks comparison winner', () => {
    expect(getComparisonWinner(90, 180)).toBe('first')
    expect(getComparisonWinner(180, 90)).toBe('second')
    expect(getComparisonWinner(120, 120)).toBe(null)
  })
})
