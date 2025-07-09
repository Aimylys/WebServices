const soap = require('soap');
const http = require('http');
const fs = require('fs');
const { Pool } = require('pg');

// Charger le fichier WSDL
//const wsdl = fs.readFileSync('productsService.wsdl', 'utf8');
const wsdl = fs.readFileSync('productsService_TP.wsdl', 'utf8');

// Config PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'produitsdb',
  password: 'Scarlette197304',
  port: 5432,
});

// Fonction async pour créer un produit en BDD
async function createProduct(args) {
  const { name, about, price } = args;

  try {
    await pool.query(
      'INSERT INTO products (name, about, price) VALUES ($1, $2, $3)',
      [name, about, price]
    );

    console.log("Produit ajouté à la base :", { name, about, price });

    return { result: `Produit ${name} ajouté avec succès en base.` };
  } catch (err) {
    console.error("Erreur lors de l'insertion :", err); // Affiche l’erreur complète
    throw {
      Fault: {
        faultcode: 'Server',
        faultstring: `Erreur lors de l’ajout du produit : ${err.message || err}`
      }
    };
  }
}

async function getProduct(args) {
  return { result: "Fonction GetProduct non encore implémentée." };
}

async function patchProduct(args) {
  return { result: "Fonction PatchProduct non encore implémentée." };
}

async function deleteProduct(args) {
  return { result: "Fonction DeleteProduct non encore implémentée." };
}


// Service SOAP avec la fonction async bien intégrée
const service = {
  ProductsService: {
    ProductsPort: {
      CreateProduct: createProduct,
	  GetProduct: getProduct,
	  PatchProduct: patchProduct,
	  DeleteProduct: deleteProduct,
    }
  }
};

// Créer le serveur HTTP
const server = http.createServer((req, res) => {
  res.end('404: Not Found');
});

// Démarrer le service SOAP
server.listen(8000, () => {
  console.log("Serveur SOAP en écoute sur http://localhost:8000/wsdl");
  soap.listen(server, '/wsdl', service, wsdl);
});
