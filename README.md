# wedding-photo-app
I built this app to allow guests at my wedding to simply and easily share 
photos and videos they captured during the day with us and other guests. 

The app was hosted as a public website and made available during the event. 
Anyone who knew the address of the site could upload media and view the 
media that others had uploaded. 

My primary aim was to make it as simple as possible for guests to upload photos
to a "private" website / storage location so we could have everybody's best
photos in one, collated location to enjoy after the event.

## Features
* A simple one-page website for event guests to upload photos & videos
  * Guests can view photos & videos uploaded by others in an event gallery
  * Guests can view large versions of the media in a lightbox
  * Managers can delete media on-the-fly to remove duplicates or inappropriate content

* Designed primarily for use on mobile phones
  * Support for image CDN to deliver resolution/quality-optimised images
  * Transcoded video assets for streaming on mobile connections
  * Original uploads are all stored in a storage bucket with no loss of quality

For more details, see the [Technical Features](#technical-features) section.

## Screenshots


---

## Quickstart

This application consists of a NodeJS web app with a "front end" (an Express 
server which serves static HTML pages) and a back-end (an API which handles 
create, read and delete operations for uploaded media files).

The web app is written to be deployed as an individual, combined service using 
[Azure Web apps](https://azure.microsoft.com/en-gb/products/app-service/web) 
and interface with other Microsoft Azure web services. 

As a minimum, the application expects an 
[Azure Blob Storage](https://azure.microsoft.com/en-gb/products/storage/blobs) 
location to be configured. This is where uploaded media will reside. This is a 
dependency for running the repository locally as well as on Azure. 

The code, as published, also expects 
[Azure Media Services](https://azure.microsoft.com/en-gb/products/media-services) 
to be configured to create compressed versions of uploaded videos to improve user 
experience when streaming video media on mobile network connections.

Note: Other cloud providers' services may be used but would require major changes
to the code.

### Environment Variables

### Azure Services

#### Azure Blob Storage

#### Azure Media Services

Note: If you do not require Azure Media Services (e.g. if you don't require video)
it would be relatively easy to remove this integration from the codebase without
major surgery. Please read the detailed notes below to familiarise with the repo.

#### Role Assignments


### To run locally

Install dependencies and start the Express server.

```npm install```

```npm start```



### To run on Azure (Web Apps)

#### Setup

#### Authorization (Role Assignments)

---


## Detailed Notes


<a name="technical-features"></a>
### Technical Features

#### Image CDN

#### Video Transcoding

### Limitations & Things To Know

#### Tested platforms

#### Security

---

## Questions & Contributions

As per the license, you are free to fork and amend this repository for your own uses.
Usage is without warranty or support and I do not guarantee the application will work 
free of defects or for your specific purposes.

If you have questions, issues or pull requests, you are welcome to contact me through
Github or [my personal website](https://andrewchart.co.uk/contact). I don't guarantee 
a response or further maintainance of this repository. 

If you have read this far - thank you for your interest!
