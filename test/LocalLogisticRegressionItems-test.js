var assert = require('assert'),
  bigml = require('../index');

describe('Manage local logistic objects', function () {
  var sourceId, source = new bigml.Source(), path = './data/movies.csv',
    datasetId, dataset = new bigml.Dataset(),
    logisticId, logistic = new bigml.LogisticRegression(),
    logisticResource, logisticFinishedResource,
    localLogistic, prediction1,
    prediction = new bigml.Prediction(),
    inputData1 = {"gender": "Female", "genres": "Adventure$Action",
                  "timestamp": 993906291, "occupation": "K-12 student",
                  "zipcode": 59583, "rating": 3};

  before(function (done) {
    var itemsField = {
      'fields': {'000007': {
        'optype': 'items', 'item_analysis': {'separator': '$'}}}};
    source.create(path, undefined, function (error, data) {
      assert.equal(data.code, bigml.constants.HTTP_CREATED);
      sourceId = data.resource;
      source.get(sourceId, true, function (error, data) {
        source.update(sourceId, itemsField, function (error, data) {
          dataset.create(sourceId, undefined, function (error, data) {
            assert.equal(data.code, bigml.constants.HTTP_CREATED);
            datasetId = data.resource;
            logistic.create(datasetId, {'objective_field': '000002', 'missing_numerics': true}, function (error, data) {
              assert.equal(data.code, bigml.constants.HTTP_CREATED);
              logisticId = data.resource;
              logisticResource = data;
              logistic.get(logisticResource, true, 'only_model=true', function (error, data) {
                logisticFinishedResource = data;
                prediction.create(logisticResource, inputData1, function(error, data) {
                  prediction1 = data;
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  describe('LocalLogisticRegression(logisticId)', function () {
    it('should create a localLogisticRegression from a logistic regression Id', function (done) {
      localLogisticRegression = new bigml.LocalLogisticRegression(logisticId);
      if (localLogisticRegression.ready) {
        assert.ok(true);
        done();
      } else {
        localLogisticRegression.on('ready', function () {assert.ok(true);
          done();
          });
      }
    });
  });
  describe('#predict(inputData, callback)', function () {
    it('should predict asynchronously from input data', function (done) {
      localLogisticRegression.predict(inputData1, function (error, data) {
        assert.equal(data["prediction"], prediction1["object"]["output"]);
        var index, probabilities = prediction1['object']['probabilities'],
          len = probabilities.length, probability;
        for (index = 0; index < len; index++) {
          if (prediction1['object']['output'] == probabilities[index][0]) {
            probability = probabilities[index][1];
            break;
          }
          distribution.push({category: probabilities[index][0],
                             probability: probabilities[index][1]});
        }
        assert.equal(Math.round(data['probability'] * 100000, 5) / 100000,
                     probability)
        done();
      });
    });
  });
  after(function (done) {
    source.delete(sourceId, function (error, data) {
      assert.equal(error, null);
      done();
    });
  });
  after(function (done) {
    dataset.delete(datasetId, function (error, data) {
      assert.equal(error, null);
      done();
    });
  });
  after(function (done) {
    prediction.delete(prediction1, function (error, data) {
      assert.equal(error, null);
      done();
    });
  });
  after(function (done) {
    logistic.delete(logisticId, function (error, data) {
      assert.equal(error, null);
      done();
    });
  });
});
