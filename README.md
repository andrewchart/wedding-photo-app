# wedding-photo-app

I built this app to allow guests at my wedding to simply and easily share 
photos and videos they captured during the day with us and other guests. 

The app was hosted as a public website and made available during the event. 
Anyone who knew the address of the site could upload media and view the 
media that others had uploaded in real time. 

My primary aim was to make it as simple as possible for guests to upload photos
via a website to a single storage location so we could have everybody's best
photos in one, collated place to enjoy after the event.

Following the event, I added the ability for a user to download the subset of 
photos and videos of interest to them (e.g. just the photos containing themselves
and their friends) by creating filters based upon facial recognition and text 
metadata.

## Features

**A simple one-page website for event guests to upload photos & videos**
* Guests can view photos & videos uploaded by others in an event gallery
* Gallery paginated with infinite scroll
* Guests can view large versions of the media in a lightbox
* Managers can delete media on-the-fly to remove duplicates or inappropriate content

**Designed primarily for use on mobile phones**
* Support for image CDN to deliver resolution/quality-optimised images
* Transcoded video assets for streaming on mobile connections
* Original uploads are all stored in a storage bucket with no loss of quality

**Download a subset of photos and videos after the event**
* The owner of the photos can create fields by which to filter the photos and videos
* Includes the ability to filter by person using facial recognition
* Users create a filtered selection and click a button to download all photos as a single zip file

For more details, see the [Technical Features](#technical-features) section.

## Screenshots


---

## Application Overview

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

_Note: Other cloud providers' services may be used but would require major changes to the code._


## Application Setup

Follow these instructions to get the application up and running.

### Step 1: Setup Azure Services

#### Azure Blob Storage

#### Azure Media Services

Note: If you do not require Azure Media Services (e.g. if you don't require video)
it would be relatively easy to remove this integration from the codebase without
major surgery. Please read the detailed notes below to familiarise with the repo.

#### Role Assignments


<a name="environment-variables"></a>
### Step 2: Define Environment Variables

| process.ENV Variable              | Description                                                                                                                    |
|-----------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| AZ_MEDIA_SERVICES_ACCOUNT_NAME    | Azure: The name of the **Azure Media Services subscription** to use.                                                           |
| AZ_MEDIA_SERVICES_RESOURCE_GROUP  | Azure: The name of the **Resource Group** to which the Azure Media Services subscription belongs.                              |
| AZ_MEDIA_SERVICES_SUBSCRIPTION_ID | Azure: The **Subscription ID** of the Azure Media Services subscription.                                                       |
| AZ_STORAGE_ACCOUNT_NAME           | Azure: The name of the **Storage Account** to use for storing and serving image & video assets.                                |
| AZ_STORAGE_CONTAINER_NAME         | Azure: The name of the **Blob Container** within the storage account where files will be stored.                               |
| IMAGE_CDN_BASE_URL                | The base url of the **Image CDN**. This will replace the storage bucket base URL for images only (see [Image CDN](#image-cdn)) |
| MANAGE_PASSWORD                   | A **password** that is required to be able to delete assets from the /manage screen.                                           |


### Step 3: To run locally

Install dependencies and start the Express server.

```npm install```

```npm start```


### Step 4: To run on Azure (Web Apps)


---


## Application Details

### Use Case Details

This section describes the use cases I envisaged and the reason to build this app as opposed to 
using another solution like a public social media platform.

<details>
<summary>#### Uploading Photos and Videos for an event</summary>

</details>

<details>
<summary>#### Downloading Photos and Videos from a past event</summary>

Consider an event with 100 attendees where 2000 photos are taken. Any given attendee may want to
download "all the photos containing myself" and "all the photos containing these friends". 

In some downloader interfaces for large sets of files, this subset could be difficult to isolate. 
Perhaps the user has to find just 3 files in the collection of 2000 by eye, or perhaps they want 75%
of the files and have to make large selections or unselect several hundred photos which they don't
want.

This app was designed to make application of metadata on a large collection easy for the owner of 
the photos, and therefore also make it easy for the users to download the subset they want, ignoring
the photos they do not want.
</details>

<a name="technical-features"></a>
### Technical Features

This section describes how the application works in

<a name="image-cdn"></a>
<details>
<summary>#### Image CDN</summary>

</details>

<details>
<summary>#### fsLightbox</summary>

</details>

<details>
<summary>#### Video Transcoding</summary>

</details>

### Folder Structure
_The following describes the folder structure of this application:_

    .
    ├── .github/workflows     # Github Actions workflow definition (auto generated by Azure)
    ├── api                   # Code that handles GET/POST/DELETE API requests
    ├── modules               # Additional server code to support the API (video transcoding code)
    ├── public                # Files available on the public website (HTML, Images, CSS & JS)
    ├── src                   # Source files for image assets. In this case Photoshop files.
    ├── .env.example          # Example of a valid .env file
    ├── .gitignore
    ├── index.js              # App entry point, Express server code and routing
    ├── package-lock.json
    ├── package.json
    ├── LICENSE
    └── README.md

### Limitations & Things To Know

#### Tested platforms

#### Security

#### Privacy

---

## Questions & Contributions

As per the license, you are free to fork and amend this repository for your own uses.
Usage is without warranty or support and I do not guarantee the application will work 
free of defects or for your specific purposes.

If you have questions, issues or pull requests, you are welcome to contact me through
Github or [my personal website](https://andrewchart.co.uk/contact-me). I don't guarantee 
a response or further maintainance of this repository. 

If you have read this far - thank you for your interest!
