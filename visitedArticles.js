// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Event listner for clicks on links in a browser action popup.
// Open the link in a new tab of the current window.
function onAnchorClick(event) {
  chrome.tabs.create({
    selected: true,
    url: event.srcElement.href
  });
  return false;
}

// Given an array of URLs, build a DOM list of those URLs in the
// browser action popup.
function buildPopupDom(divName, data) {
  var popupDiv = document.getElementById(divName);

  var ul = document.createElement('ul');
  popupDiv.appendChild(ul);

  var titles = data['titles'],
      urls = data['urls'];

  if (titles.length == urls.length) {
    for (var i = 0, ie = titles.length; i < ie; ++i) {
      var a = document.createElement('a');
      a.href = urls[i];
      a.appendChild(document.createTextNode(titles[i]));
      a.addEventListener('click', onAnchorClick);

      var li = document.createElement('li');
      li.appendChild(a);

      ul.appendChild(li);
    }
  } // TODO: Else throw some sort of error?
}

// Search history to find up to ten links that a user has typed in,
// and show those links in a popup.
function buildTypedUrlList(divName) {
  // To look for history items visited in the last week,
  // subtract a week of microseconds from the current time.
  var microsecondsPerWeek = 1000 * 60 * 60 * 24 * 7;
  var oneWeekAgo = (new Date()).getTime() - microsecondsPerWeek;

  // Track the number of callbacks from chrome.history.getVisits()
  // that we expect to get.  When it reaches zero, we have all results.
  var numRequestsOutstanding = 0;

  chrome.history.search({
      'text': '',              // Return every wiki item
      'startTime': oneWeekAgo  // that was accessed less than one week ago.
    },
    function(historyItems) {
      console.log('history items retrieved ', historyItems)
      var processVisitsWithUrl = function(url, title) {
        // We need the url of the visited item to process the visit.
        // Use a closure to bind the  url into the callback's args.
        return function(visitItems) {
          processVisits(url, title, visitItems);
        };
      };

      // Decide if url should be processed
      // TODO: Add more sophisticated things here: quora?
      var urlShouldBeProcessed = function(url) {
        return (url.indexOf('wikipedia') !== -1);
      };

      // For each history item, get details on all visits.
      for (var i = 0; i < historyItems.length; ++i) {
        var url = historyItems[i].url,
            title = historyItems[i].title;
        if (urlShouldBeProcessed(url)) {
          chrome.history.getVisits({url: url}, processVisitsWithUrl(url, title));
          numRequestsOutstanding++;
        }
      }
      if (!numRequestsOutstanding) {
        onAllVisitsProcessed();
      }
    });


  // Maps URLs to a count of the number of times the user typed that URL into
  // the omnibox.
  var urlToCount = {},
      titleToCount = {};

  // Callback for chrome.history.getVisits().  Counts the number of
  // times a user visited a URL.
  var processVisits = function(url, title, visitItems) {
    for (var i = 0, ie = visitItems.length; i < ie; ++i) {
      if (!urlToCount[url]) {
        urlToCount[url] = 0;
      }
      urlToCount[url]++;

      // Adding title handling and extracting code for Wikipedia
      if (!titleToCount[title]) {
        titleToCount[title] = 0;
      }
      titleToCount[title]++;
    }

    // If this is the final outstanding call to processVisits(),
    // then we have the final results.  Use them to build the list
    // of URLs to show in the popup.
    if (!--numRequestsOutstanding) {
      onAllVisitsProcessed();
    }
  };

  // This function is called when we have the final list of URls to display.
  var onAllVisitsProcessed = function() {
    // Get the top scoring urls.
    urlArray = [];
    for (var url in urlToCount) {
      urlArray.push(url);
    }

    // Get the top scoring titles.
    titleArray = [];
    for (var title in titleToCount) {
      titleArray.push(title);
    }

    // Sort the URLs by the number of times the user typed them.
    urlArray.sort(function(a, b) {
      return urlToCount[b] - urlToCount[a];
    });

    // Sort the titles by the number of times the user typed them.
    titleArray.sort(function(a, b) {
      return titleToCount[b] - titleToCount[a];
    });

    buildPopupDom(divName, {titles: titleArray.slice(0, 10), urls: urlArray.slice(0, 10)});
  };
}

document.addEventListener('DOMContentLoaded', function () {
  buildTypedUrlList("visitedArticle_div");
});