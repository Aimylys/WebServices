const soap = require('soap');

soap.createClient("http://localhost:8000/wsdl?wsdl", {}, function (err, client) {
  if (err) {
    console.error("Error creating SOAP client:", err);
    return;
  }

  // CREATE
  client.CreateProduct({
    name: "My product",
    about: "Description of my product",
    price: 99
  }, function (err, result) {
    if (err) {
      console.error("CreateProduct error:", err);
    } else {
      console.log("CreateProduct result:", result);
    }
  });

  // GET
  client.GetProduct({}, function (err, result) {
    if (err) {
      console.error("GetProduct error:", err);
    } else {
      console.log("GetProduct result:", result);
    }
  });

  // PATCH
  client.PatchProduct({
    id: "123", // à remplacer par un vrai ID
    name: "Updated name",
    about: "Updated about",
    price: 149
  }, function (err, result) {
    if (err) {
      console.error("PatchProduct error:", err);
    } else {
      console.log("PatchProduct result:", result);
    }
  });

  // DELETE
  client.DeleteProduct({
    id: "123" // à remplacer par un vrai ID
  }, function (err, result) {
    if (err) {
      console.error("DeleteProduct error:", err);
    } else {
      console.log("DeleteProduct result:", result);
    }
  });
});
