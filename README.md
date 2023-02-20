# Stayfy app's API services

Hello there! this is a simple backend for my Stayfy app.

Check out the project: [stayfy.vercel.app/](https://stayfy.vercel.app/)

## GET

### To get all collections from either founders/facts/filters/locations/facilities:

https://stayfy-backend-production.up.railway.app/all-docs/:collection


### To get user upcoming trips:

https://stayfy-backend-production.up.railway.app/upcoming-trips/:userId


### To get lodges by IDs. Param queries: { lodgeIds }.

https://stayfy-backend-production.up.railway.app/lodges-by-ids


### To get paginated lodges. Param queries: { cursor , numOfItems, featureFilter, locationFilter, price, facilities, typesOfStay }.

https://stayfy-backend-production.up.railway.app/lodges-by-ids


### To get certain lodges by order and filter. Param queries: { descending, filter, limit }.

https://stayfy-backend-production.up.railway.app/query-lodge

## POST


### To log user in. body: { email, password }

https://stayfy-backend-production.up.railway.app/login


### To sign user up. body: { firstName, lastName, phone, email, password }

https://stayfy-backend-production.up.railway.app/login


### To add subscription. body: { email }

https://stayfy-backend-production.up.railway.app/add-subscription


### To add booking. body: { bookingData, userId }

https://stayfy-backend-production.up.railway.app/add-booking


## PATCH


### To update user info. body: { userId, updatedData }

https://stayfy-backend-production.up.railway.app/update-user


## DELETE

### To delete user. body: { userId }

https://stayfy-backend-production.up.railway.app/delete-user


### To delete trip. body: { bookingId, userId }

https://stayfy-backend-production.up.railway.app/delete-trip
