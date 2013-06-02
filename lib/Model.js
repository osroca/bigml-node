/**
 * Copyright 2012 BigML
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */
"use strict";

var util = require('util');
var events = require('events');
var utils = require('./utils');
var BigMLModel = require('./BigMLModel');
var constants = require('./constants');
var Tree = require('./Tree');


function mapType(type) {
  /**
   * Returns function to cast to type
   *
   * @param {string} type
   */
  if (type === 'numeric') {
    // TODO: find a way to interpret not en_US locales
    return parseFloat;
  }
  return String;
}

function stripAffixes(value, field) {
  /**
   * Strips prefixes and suffixes for numerical input data fields
   *
   * @param {string} value Value of the field
   * @param {object} field model's field
   */
  if (field.prefix && value.indexOf(field.prefix) === 0) {
    value = value.substring(field.prefix.length);
  }
  if (field.suffix && value.indexOf(field.suffix) === value.length - field.suffix.length) {
    value = value.substring(0, value.length - field.suffix.length);
  }
  return value;
}

function cast(inputData, fields) {
  /**
   * Sets the right type for input data fields
   *
   * @param {object} inputData Input data to predict
   * @param {object} fields Model's fields collection
   */
  var field, value;
  for (field in inputData) {
    if (inputData.hasOwnProperty(field)) {
      if ((fields[field].optype === 'numeric' &&
           (typeof inputData[field]) === 'string') ||
          (fields[field].optype !== 'numeric' &&
            (typeof inputData[field] !== 'string'))) {
        try {
          if (fields[field].optype === 'numeric') {
            value = stripAffixes(inputData[field], fields[field]);
            inputData[field] = mapType(fields[field].optype)(value);
          }
        } catch (error) {
          throw new Error('Mismatch input data type in field ' +
                          fields[field].name + 'for value ' +
                          inputData[field]);
        }
      }
    }
  }
  return inputData;
}

function invertObject(fields) {
  /**
   * Creates a field name to Id hash.
   *
   * @param {object} fields Model's fields
   */
  var newObject = {}, field;
  for (field in fields) {
    if (fields.hasOwnProperty(field)) {
      newObject[fields[field].name] = field;
    }
  }
  return newObject;
}

/**
 * Model: Simplified local object for the model resource.
 * @constructor
 */
function Model(resource, connection) {
  /**
   * Constructor for the Model local object
   *
   * @param {object} resource BigML model resource
   * @param {object} connection BigML connection
   */

  var model, self, fillStructure;
  this.resourceId = utils.getResource(resource);
  if ((typeof this.resourceId) === 'undefined') {
    throw new Error('Cannot build a Model from this resource: ' + resource);
  }

  this.invertedFields = undefined;
  this.allInvertedFields = undefined;
  this.tree = undefined;
  this.description = undefined;
  this.locale = undefined;
  this.ready = undefined;

  self = this;
  fillStructure = function (error, resource) {
    /**
     * Auxiliary function to load the resource info in the Model structure
     *
     * @param {object} error Error info
     * @param {object} resource Model's resource info
     */
    var status, fields, field, fieldInfo;
    if (error) {
      throw new Error('Cannot create the Model instance. Could not' +
                      ' retrieve the resource: ' + error);
    }
    status = utils.getStatus(resource);
    if ((typeof resource.object) !== 'undefined') {
      resource = resource.object;
    }
    if ((typeof resource.model) !== 'undefined') {
      if (status.code === constants.FINISHED) {
        if ((typeof resource.model['model_fields']) !== 'undefined') {
          fields = resource.model['model_fields'];
          for (field in fields) {
            if (fields.hasOwnProperty(field)) {
              if (!resource.model.fields.hasOwnProperty(field)) {
                throw "Some fields are missing to generate a local model.\n" +
                      "Please provide a model with the complete list of fields";
              }
              fieldInfo = resource.model.fields[field];
              fields[field].summary = fieldInfo.summary;
              fields[field].name = fieldInfo.name;
            }
          }
        } else {
          fields = resource.model.fields;
        }
        self.invertedFields = invertObject(fields);
        self.allInvertedFields = invertObject(resource.model.fields);
        self.tree = new Tree(resource.model.root, fields, resource['objective_fields']);
        self.description = resource.description;
        self.locale = resource.locale || constants.DEFAULT_LOCALE;
        self.ready = true;
        self.emit('ready', self);
      }
    } else {
      throw new Error('Cannot create the Model instance. Could not' +
                      ' find the \'model\' key in the resource\n');
    }
  };

  // Loads the model when only the id is given
  if ((typeof resource) === 'string') {
    model = new BigMLModel(connection);
    model.get(resource, true, 'limit=-1', fillStructure);
  } else {
  // loads when the entire resource is given
    fillStructure(null, resource);
  }
  events.EventEmitter.call(this);
}

util.inherits(Model, events.EventEmitter);

Model.prototype.predict = function (inputData, cb) {
  /**
   * Makes a prediction based on a number of field values.
   *
   * The input fields must be keyed by field name.
   * @param {object} inputData Input data to predict
   * @param {function} cb Callback
   */
  var newInputData = {}, field, prediction;

  if (this.ready) {
    for (field in inputData) {
      if (inputData.hasOwnProperty(field)) {
        if (inputData[field] === null ||
            (!this.invertedFields.hasOwnProperty(field))) {
          delete inputData[field];
        } else {
          newInputData[String(this.invertedFields[field])] = inputData[field];
        }
      }
    }
    try {
      inputData = cast(newInputData, this.tree.fields);
    } catch (err) {
      if (cb) {
        return cb(err, null);
      }
      throw err;
    }
    prediction = this.tree.predict(inputData);
    if (cb) {
      return cb(null, prediction);
    }
    return prediction;
  }
  this.on('ready', function (self) {return self.predict(inputData, cb); });
  return;
};

module.exports = Model;