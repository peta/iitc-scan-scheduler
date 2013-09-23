# 24/7 Intel event scanner and aggregation server application

IMPORTANT: In order to use this application you need a working binary of phantomJS version 1.9.1. Here you can find prebuilt binaries and the source code: [http://phantomjs.org/download.html](http://phantomjs.org/download.html)

## Configuration file

IMPORTANT: Rename file `config.example.json` to `config.json` and fill in your Ingress credentials. Otherwise the application won't work.

+ All time values are SECONDS. No milliseconds. SECONDS.
+ All memory related values are BYTES.

# Services

+ Screenshot capture service
+ Scan schedule editor
+ Event data streaming service

## Screenshot capture service

There is a HTTP endpoint exposed at [http://localhost:9001/](http://localhost:9001/) that serves fullsize screenshots of the involved Intel webpage on demand. The screenshot size depends on what viewport size has been configured. By default the served website that contains the screenshot image (embedded; base64 encoded) will refresh itself every 10s. There is a checkbox for controlling this behaviour.

Served screenshots have all additional UI dialogs/panels (sidebar, chat, additional map/tile overlays) hidden – only the map, portals, links and fields are visible.

## Scan scheduler with editor

There is a HTTP endpoint exposed at [http://localhost:9002/scheduler](http://localhost:9002/scheduler) that serves a simple web application for managing what geographic areas will be monitored for events. Although the scanner can be started/stopped via a simple HTTP API, the editor doesn't support this yet (trivial to add).

LeafletJS is displaying OSM/GMaps map tiles to user. Leaflet.draw plugin (with restriction to rectangular elements) is enabled and allows the user to draw rectangles (called "scanner fields") over the geographic area that will be monitored for new events on periodical basis.

The drawn rectangles are persisted in a flat file as GeoJSON data which is used by both, the scan scheduler and the phantomJS iitc-server. (locking!) For now, only one person may use the schedule editor at a time. When the schedule editor is started, it reads the data file and plots its content on the map. When the editor is instructed to persist its state, LeafletJS is used to generate the according GeoJSON data and the file's content is replaced with it.

When the phantomJS server starts monitoring, it parses the aforementioned GeoJSON file and iterates over all contained GeoJSON Feature objects and processes each of them. Therefore it takes its geometric boundaries and calculates how many scanner viewports it takes to cover the according map area, based on the used screen size and the zoom level needed to catch Level 1 portals. Optionally debug tile data can be returned that can be plotted on the map for debugging purposes.

Execution is paused (configurable) after each field/sector scan and before the next re-scan.

### Debug mode

If you set the config setting `debug` to `true`, the scanner will generate two types of debug data and writes them to a file:

#### Field sectors

The file `data/debug/sectors.json` will contain all generated tiles in GeoJSON format. In order to visualize them, just open [the schedule editor page](http://localhost:9002/scheduler), fire up the webdeveloper dialog and enter the following code:

`L.geoJson(jsonDataFromFile).addTo(map);` whereas `jsonDataFromFile` is the copy&pasted content of the aforementioned JSON file.

#### Portal entities

*IMPLEMENTATION INCOMPLETE*

Right now only the raw and unprocessed event data (received by a listener to "scanner:scanFinished") is written to timestamp-named JSON file that is placed inside the `data/scans` folder. Note that this data still contains duplicates and isn't reasonably normalized.

## Event data streaming service

*IMPLEMENTATION PENDING*

The data streaming service does no data evaluation or aggregation. It only collects the according data, performs simple de-duplication, filters out personal event data, persists it and exposes an API that can be used by clients to query the data. Data can also be automatically pushed to a pre-configured endpoint.

### Pending tasks

+ 2.3.2	Save data for: public+faction chat and fetch data of all portals in range
+ 2.4   Merge/de-dup data from all Ingress tiles
+ 2.5   Filter out personal events ("Your portal is under attack" asf.)
+ 3.	Push newly collected data to ???

# TODO

+ Add random jitter factor to pauses between scan operations
+ Store every external script file (iitc, plugins) in private GitHub Gist and introduce ghetto update checker that reloads default page when new versions are available
+ When in debug mode, create GeoJSON file with sector outline and all contained portals so that I can test the scanner behaviour
+ Figure out how to effectively persist data and how to expose it to consumer clients
+ Refactor code and inject context object to prevent nested closures
+ Collect chat data of Resistance faction; create second account
+ Improve algorithm for calculating scanner sectors (reduce overlapping areas and intelligently adjust file size to prevent scanning of outside area)
+ Implement simple locking mechanism for data files
+ Add pid file to prevent multiple iitc-server instances in the same folder
+ General code review





