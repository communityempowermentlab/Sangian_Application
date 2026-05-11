const controller = require('./src/controllers/gameController.js');
const req = { params: { gameName: 'rover_mela' } };
const res = {
  status: function(c) { this.statusCode = c; return this; },
  json: function(obj) { console.log("Success:", obj.success, "Data length:", obj.data ? obj.data.length : 0); }
};
controller.getReportDetail(req, res).catch(console.error);
