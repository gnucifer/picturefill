/*jshint loopfunc: true, browser: true, curly: true, eqeqeq: true, expr: true, forin: true, latedef: true, newcap: true, noarg: true, trailing: true, undef: true, unused: true */
/*! Picturefill - Original author: Scott Jehl, 2012, Rewritten by: David Gustafsson, 2014 | License: MIT/GPLv2 */
(function(exports, w, parent) {

  // Enable strict mode.
  "use strict";

  //TODO don't include polyfill?
  //From: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf
  if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (searchElement, fromIndex) {
      if ( this === undefined || this === null ) {
        throw new TypeError( '"this" is null or not defined' );
      }

      var length = this.length >>> 0; // Hack to convert object.length to a UInt32

      fromIndex = +fromIndex || 0;

      if (Math.abs(fromIndex) === Infinity) {
        fromIndex = 0;
      }

      if (fromIndex < 0) {
        fromIndex += length;
        if (fromIndex < 0) {
          fromIndex = 0;
        }
      }

      for (;fromIndex < length; fromIndex++) {
        if (this[fromIndex] === searchElement) {
          return fromIndex;
        }
      }

      return -1;
    };
  }

 
  // Picture construct
  function Picture(element) {
    this.element = element;
    this.sources = {};
    this.mqls = [];
    this.current_media = null;
    this.img = null;

    var source_spans = element.getElementsByTagName('span');
    //Index sources by media query
    for (var i = 0, il = source_spans.length; i < il; i++ ) {
      var media = source_spans[i].getAttribute('data-media') || 'default';
      this.sources[media] = source_spans[i];
      if(media !== 'default') {
        this.mqls.push(media);
      }
    }

    if(!('default' in this.sources)) {
      this.sources['default'] = source_spans[i - 1];
    }

    var self = this;

    this._setMedia = function(media) {
      //Protect against unnecessary reloading of image where for example the 'default' source is the same as current media
      if(
        self.current_media === null ||
        self.sources[self.current_media].getAttribute('data-src') !== self.sources[media].getAttribute('data-src')
      ) {
        if(!self.img) {
          this.img = w.document.createElement('img');
          if(this.element.getAttribute('data-alt')) {
            this.setImgAttribute('alt', this.element.getAttribute('data-alt'));
          }
          if(this.element.getAttribute('data-title')) {
            this.setImgAttribute('title', this.element.getAttribute('data-title'));
          }
          self.appendImgElement();
        }
        var source = this.sources[media];
        this.setImgAttribute('src', source.getAttribute('data-src'));
        if (source.getAttribute('data-width') && source.getAttribute('data-height')) {
          this.setImgAttribute('width', source.getAttribute('data-width'));
          this.setImgAttribute('height', source.getAttribute('data-height'));
        }
      }
      self.current_media = media;
    };
  }

  Picture.prototype.setMedia = function(media_query, prune) {
    var prune = prune || true;

    if(!(media_query in this.sources) || media_query === this.current_media) {
      //Do nothing
      return;
    }

    //Special case for 'default'
    if(media_query === 'default') {
      this._setMedia(media_query);
    }
    else {
      for(var i = 0, il = this.mqls.length; i < il; i++) {
        if(this.mqls[i] === media_query) {
          this._setMedia(media_query);
          if(prune) {
            //TODO: verify that empty array if i = length - 1?
            this.mqls = this.mqls.slice(i + 1);
            //TODO: prune sources as well?
          }
        }
      }
    }
  }

  Picture.prototype.getLastMatchingMedia = function(media_queries) {
    //Create a local copy
    var _media_queries = media_queries.slice();
    var last_match = null;
    for(var i = 0, il = this.mqls.length; i < il; i++) {
      var index = _media_queries.indexOf(this.mqls[i]);
      if(index !== -1) {
        last_match = this.mqls[i];
        _media_queries.splice(index, 1);
      }
      if(!_media_queries.length) {
        break;
      }
    }
    return last_match || 'default';
  };

  Picture.prototype.setLastMatchingMedia = function(media_queries, prune) {
    this.setMedia(this.getLastMatchingMedia(media_queries), prune);
  }

  Picture.prototype.appendImgElement = function () {
    this.element.appendChild(this.img);
  }

  Picture.prototype.setImgAttribute = function (name, value) {
    this.img.setAttribute(name, value);
  }

  exports.picturefill = function(parent, options) {

    var options = options || {};

    if(!('prune' in options)) {
      options.prune = true;
    }

    // Get all picture tags.
    if (!parent || !parent.getElementsByTagName) {
      parent = w.document;
    }
    var spans = parent.getElementsByTagName('span');
    
    //Index picture elements by their media queries
    var mqls = {};

    var picture_elements = [];

    // Loop over the pictures, create picture elements and group by media queries
    for (var i = 0, il = spans.length; i < il; i++ ) {
      if (spans[i].getAttribute('data-picture') !== null) {
        var picture_element = new Picture(spans[i]);
        picture_elements.push(picture_element);
        for (var j = 0, jl = picture_element.mqls.length; j < jl; j++ ) {
          var media = picture_element.mqls[j];
          if(!(media in mqls)) {
            mqls[media] = [];
          }
          mqls[media].push(picture_element);
        }
      }
    }

    function mql_listener(picture_elements, media_query) {
      var self = function(mql) {
        if(mql.matches) {
          for(var i = 0, il = picture_elements.length; i < il; i++) {
            //We cannot use mql.media because not guaranteed to be the same as the media query string
            picture_elements[i].setMedia(media_query, options.prune);
          }
          mql.removeListener(self);
        }
      }
      return self;
    }

    //Add listeners and detect current media
    var matching_mqls = [];
    for(var media_query in mqls) {
      var mql = w.matchMedia(media_query);
      if(mql.matches) {
        matching_mqls.push(media_query);
      }
      mql.addListener(mql_listener(mqls[media_query], media_query));
    }

    for(var i = 0, il = picture_elements.length; i < il; i++) {
      picture_elements[i].setLastMatchingMedia(matching_mqls, options.prune);
    }

  };

  exports.Picture = Picture;

  // Run on resize and domready (w.load as a fallback)
  // Remove comments if you whant the script to automatically apply globally:
  /*
  if (w.addEventListener) {
    w.addEventListener('resize', w.picturefill, false);
    w.addEventListener('DOMContentLoaded', function() {
        w.picturefill();
        // Run once only.
        w.removeEventListener('load', w.picturefill, false);
      }, false);
    w.addEventListener('load', w.picturefill, false);
  }
  else if (w.attachEvent) {
    w.attachEvent('onload', w.picturefill);
  }
  */

})(window, this);
