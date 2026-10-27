// Ye values supabase migrations ke check constraints se match karti hain
export const PARCEL_STATUSES = [
  'Booked',
  'Picked',
  'At Head Office',
  'In Transit',
  'Arrived at Destination',
  'Out for Delivery',
  'Delivered',
  'Returned',
  'Cancelled',
]
// Jo parcels abhi raste mein / kaam mein hain
export const ACTIVE_STATUSES = ['Booked', 'Picked', 'At Head Office', 'In Transit', 'Arrived at Destination', 'Out for Delivery']
export const DELIVERY_TYPES = ['Local', 'Domestic', 'International']
export const REQUEST_STATUSES = ['Pending', 'Approved', 'Paid', 'Rejected']
export const RIDER_STATUSES = ['Active', 'Inactive']
export const COMPANY_STATUSES = ['Active', 'Pending', 'Suspended']
export const CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Sialkot']
export const COUNTRIES = [
  'Pakistan',
  'United Arab Emirates',
  'Saudi Arabia',
  'Qatar',
  'Oman',
  'United Kingdom',
  'United States',
  'Canada',
  'China',
  'Malaysia',
]

// Charges (database ke calc_delivery_charges() jaisa)
export function deliveryCharges({ city, weight, country }, rates, settings) {
  const kg = Math.ceil(Number(weight) || 0)
  if ((country || 'Pakistan').trim().toLowerCase() !== 'pakistan') {
    return Number(settings.intl_base_charge ?? 3000) + kg * Number(settings.intl_per_kg ?? 1500)
  }
  const rate = rates.find((r) => r.city.toLowerCase() === (city || '').trim().toLowerCase())
  if (rate) return Number(rate.base_charge) + kg * Number(rate.per_kg)
  return Number(settings.domestic_base_charge ?? 250) + kg * Number(settings.domestic_per_kg ?? 100)
}

export function deliveryType({ city, country }, settings) {
  if ((country || 'Pakistan').trim().toLowerCase() !== 'pakistan') return 'International'
  return (city || '').trim().toLowerCase() === (settings.hub_city || 'Lahore').toLowerCase() ? 'Local' : 'Domestic'
}
