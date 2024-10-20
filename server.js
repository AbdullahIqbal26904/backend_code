const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const secret_key = 'sdf$92jsL9sN2%@0J!sdf0LKsm93#asF8!';
const app = express();
app.use(cors());
app.use(bodyParser.json());
require('dotenv').config();


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + file.originalname);
  }
});
const upload = multer({ storage: storage });

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

let db; // Declare db variable globally

function handleDisconnect() {
  try{
    db = mysql.createConnection(dbConfig); // Recreate the connection
    console.log('MySql Successfully Connected....');
  }catch(err){
    console.log('Error connecting to MySql....')
  }
}

// Start the connection process
handleDisconnect();

app.get('/data', (req, res) => {
  handleDisconnect();
  let sql = 'SELECT * FROM users';
  db.query(sql, (err, result) => {
    if (err) throw err;
    res.json(result);
  });
});

app.post('/products', upload.single('imgdata'), (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  let addProdquery = ``;
  const { name, description, category, price, ratings, qnty, imgdata, imageUrl } = req.body;
  if (imageUrl == "") {
    addProdquery = `INSERT INTO PRODUCTS (name, description, category, price, ratings, qnty, imgdata) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.query(addProdquery, [name, description, category, price, ratings, qnty, imgdata], (err, result) => {
      if (err) {
        return res.status(500).send('Error adding product');
      } else {
        res.send('Product Successfully added');
      }
    });
  } else {
    const { name, description, category, price, ratings, qnty, imgUrl } = req.body;

    addProdquery = `INSERT INTO PRODUCTS (name, description, category, price, ratings, qnty, imgurl) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.query(addProdquery, [name, description, category, price, ratings, qnty, imageUrl], (err, result) => {
      if (err) {
        return res.status(500).send('Error adding product');
      } else {
        res.send('Product Successfully added');
      }
    });
  }

});

app.post('/signup', async (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { name, email, password, Customer } = req.body;
  let select = 'SELECT * FROM users WHERE Email = ?';
  db.query(select, [email], async (err, result) => {
    if (err) throw err;
    else if (result.length > 0) {
      return res.status(409).send('User already registered');
    } else {
      const hashedpasswords = await bcrypt.hash(password, 10);
      const insertUserQuery = 'INSERT INTO users (Name, Email, Password,role) VALUES (?, ?, ?,?)';
      db.query(insertUserQuery, [name, email, hashedpasswords, Customer], (err, result) => {
        if (err) {
          return res.status(500).send('Error registering user');
        }
        res.send('User registered successfully');
      });
    }
  });
});
app.post('/login', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { email, password } = req.body;
  const query2 = 'SELECT * FROM users WHERE Email = ?';
  db.query(query2, [email], (err, result) => {
    if (err) {
      return res.status(500).send('Error logging in');
    }
    if (result.length > 0) {
      const user = result[0];
      const passwordValid = bcrypt.compare(password, user.Password);

      if (!passwordValid) {
        return res.status(401).send('Invalid credentials');
      }
      const token = jwt.sign({ id: user.id, role: user.role }, secret_key, { expiresIn: '1h' });
      console.log(user);
      res.json({
        token,
        user: {
          id: user.id,
          name: user.Name,
          email: user.Email,
          role: user.role
        }
      })
      // res.send(result);
    } else {
      res.status(401).send('Invalid credentials');
    }
  });
});
// app.post('/login', (req, res) => {
//   const { email, password } = req.body;
//   const query2 = 'SELECT * FROM users WHERE Email = ? AND Password = ?';
//   db.query(query2, [email, password], (err, result) => {
//     if (err) {
//       return res.status(500).send('Error logging in');
//     }
//     if (result.length > 0) {
//       res.send(result);
//     } else {
//       res.status(401).send('Invalid credentials');
//     }
//   });
// });
app.post('/createCart', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { created_date, created_time, id } = req.body;
  const checkCartQuery = 'SELECT * FROM Cart WHERE id = ?';
  db.query(checkCartQuery, [id], (err, existingCart) => {
    if (err) {
      console.error('Error checking cart:', err);
      return res.status(500).send('Error checking cart');
    }
    if (existingCart.length > 0) {
      return res.status(400).json({ message: 'Cart already exists for this user.' });
    }
    const createCartQuery = 'INSERT INTO Cart (created_date, created_time, id) VALUES (?, ?, ?)';
    db.query(createCartQuery, [created_date, created_time, id], (err, response) => {
      if (err) {
        console.error('Error creating cart:', err);
        return res.status(500).send('Error creating cart');
      }
      res.json({
        success: true,
        message: 'Cart created successfully',
        cartId: response.insertId
      });
    });
  });
});

app.post("/addtocart", (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { cart_id, product_id, quantity, price } = req.body;
  const isproductinstock = `SELECT qnty FROM PRODUCTS WHERE id = ? AND qnty > 0`;
  db.query(isproductinstock, [product_id], (err, result) => {
    if (err) {
      console.log(err);
      return;
    } else if (result.length === 0) {
      return res.status(400).json({ message: 'Product is out of stock.' });
    } else if (result.length > 0) {
      const check = `SELECT * FROM cartItems WHERE id = ? AND cart_id = ?`;
      db.query(check, [product_id, cart_id], (err, result) => {
        if (err) {
          return res.status(500).json({ message: 'Error fetching data.' });
        } else if (result.length > 0) {
          // this means product already exists in the cart
          return res.status(400).json({ message: 'Product is already added in cart.' })
        } else {
          const addtocartt = `INSERT INTO cartItems (id,cart_id,total_item_price,quantity) VALUES (?, ?, ?, ?)`;
          if (cart_id != 0 && product_id != 0) {
            console.log('Received data from axios :', cart_id, product_id);
            db.query(addtocartt, [product_id, cart_id, price, quantity], (err, response) => {
              if (err) {
                console.log(err);
                res.status(400).json({ message: 'Server Error' });
              } else {
                res.json({
                  success: true,
                  message: 'Item added to cart'
                });
              }
            })
          }
        }
      })
    }
  })
})

app.get("/getcartdata", (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { cart_id } = req.query;
  const get_query = `SELECT P.*,ci.quantity FROM PRODUCTS P JOIN cartItems ci ON P.id = ci.id JOIN Cart C ON C.cart_id = ci.cart_id WHERE C.cart_id = ?`;
  console.log("fetching data of cart: ", cart_id);
  db.query(get_query, [cart_id], (err, result) => {
    if (err) {
      console.log('Cannot be fetched.')
    } else if (result.length > 0) {
      res.json(result);
    }
  })
})

app.get(`/getcarttotal`, (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { cart_id2 } = req.query;
  const get_cart_total = `select sum(ci.total_item_price) as total from cartItems ci inner join Cart c on ci.cart_id = c.cart_id where c.cart_id = ?`
  db.query(get_cart_total, [cart_id2], (err, result) => {
    if (err) {
      console.log('Error fetching total.');
    } else {
      res.json(result);
    }
  })
})

app.put("/updatequantity", (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { qnty_fr_db, prod_id, cart_id, prod_price } = req.body;
  const update = `UPDATE cartItems set quantity = quantity + (?),total_item_price = (quantity * ?) where id=? AND cart_id = ?`;
  db.query(update, [qnty_fr_db, prod_price, prod_id, cart_id], (err, result) => {
    if (err) {
      res.status(400).json({ message: 'Unable to update quantity.' })
    } else {
      res.json(result);
    }
  })
})
//For Order placement
app.put('/createOrder', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { date, time, total, status, id } = req.body;
  const makeOrder = `INSERT INTO Orders(order_Date,order_Time,total_amount,order_status,id) VALUES(?,?,?,?,?)`;
  console.log('order making.............');
  db.query(makeOrder, [date, time, total, status, id], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: err.message });
    } else {
      const lastInsertedId = result.insertId;

      // Respond with the last inserted ID
      return res.status(201).json({ orderId: lastInsertedId });
    }
  })
})

app.put('/deliveryinfo', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { email, address, city, paymentmethod, postalcode, phoneno, userid } = req.body;

  // SQL query to check if delivery info already exists
  const checkQuery = `SELECT delivery_id FROM Delivery WHERE delivery_address = ? AND delivery_city = ? AND postal_code = ? AND phoneNo = ? AND payment_method = ? AND id = ?`;

  // SQL query to insert delivery info if it doesn't exist
  const insertQuery = `INSERT INTO Delivery (delivery_address, delivery_city, payment_method,postal_code,phoneNo,id) VALUES (?, ?, ?, ?, ?, ?)`;

  // Execute the check query first
  db.query(checkQuery, [address, city, postalcode, phoneno, paymentmethod, userid], (err, result) => {
    if (err) {
      console.log('errror', err);
      return res.status(500).send('Error checking delivery info');
    }

    // If delivery info exists, return the corresponding id
    if (result.length > 0) {
      console.log('id already exists', result[0].delivery_id);
      return res.status(200).json({ id: result[0].delivery_id });

    }
    // If delivery info doesn't exist, insert new values
    db.query(insertQuery, [address, city, paymentmethod, postalcode, phoneno, userid], (err, insertResult) => {
      if (err) {
        console.log('error', err);
        return res.status(500).send('Error inserting delivery info');
      }
      console.log('hurray')
      // Return the newly inserted id
      res.status(201).json({ id: insertResult.insertId });
    });
  });
});


app.put('/deliveryOrder', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { deliver_yid, ordera_id } = req.body;
  const insertindeliveryorder = `INSERT INTO deliveryOrder (delivery_id,order_id) VALUES (?,?)`;
  db.query(insertindeliveryorder, [deliver_yid, ordera_id], (err, result) => {
    if (err) {
      res.status(500).send('Server error');
    } else {
      const lastInsertedId = result.insertId;

      // Respond with the last inserted ID
      return res.status(201).json({ delivery_orderid: lastInsertedId });
    }
  })
})

app.put('/orderproductstable', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { prod_id, orderrrid, quantity } = req.body;
  const addtoorderproducts = `INSERT INTO orderProducts (id,order_id,quantity) VALUES(?,?,?)`;
  console.log('prod_id', prod_id, 'orderid', orderrrid);
  db.query(addtoorderproducts, [prod_id, orderrrid, quantity], (err, result) => {
    if (err) {
      res.status(500).send('Error');
    } else {
      const lastInsertedId = result.insertId;
      // Respond with the last inserted ID
      return res.status(201).json({ order_product_id: lastInsertedId });
    }
  })
})

app.delete('/emptycart', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { useraid } = req.body; // Should match what you're sending from the client

  if (!useraid) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  const delquery = `
      DELETE ci FROM users u 
      inner join Cart c on c.id = u.id 
      inner join cartItems ci on ci.cart_id = c.cart_id 
      where u.id = ?`;

  console.log('Deleting cart of user id:', useraid);

  db.query(delquery, [useraid], (err, result) => {
    if (err) {
      console.error('Error:', err);
      return res.status(500).json({ message: 'An error occurred while emptying the cart' });
    }

    console.log('Cart emptied for user id:', useraid);
    res.status(200).json({ message: 'Cart emptied successfully' });
  });
});

app.put('/updatestock', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { productid, productquantity } = req.body;
  const updatestock = `UPDATE PRODUCTS SET qnty = qnty - ? WHERE id = ?`;
  db.query(updatestock, [productquantity, productid], (err, result) => {
    if (err) {
      res.status(500).json({ message: 'Quantity update unsuccessful' });
    } else {
      const lastInsertedId = result.insertId;
      // Respond with the last inserted ID
      return res.status(201).json({ updatedproduct: lastInsertedId });
    }
  })
})

// Order placement ends here
app.get('/getCart/:id', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const userId = req.params.id;

  // Query to fetch the cart for the given user ID
  const getCartQuery = `SELECT * FROM Cart WHERE id = ?`;
  console.log('fetching cart of :', userId);
  db.query(getCartQuery, [userId], (err, cart) => {
    if (err) {
      console.error('Error fetching cart:', err);
      return res.status(500).send('Error fetching cart');
    }

    // If no cart found for this user
    if (cart.length === 0) {
      return res.status(404).json({ message: 'No cart found for this user.' });
    }
    console.log(cart);
    // Send the cart data as the response
    res.json(cart);
  })
}
);

app.get('/productsbyrange', async (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { minPrice, maxPrice } = req.query;
  const query_get = `SELECT * FROM PRODUCTS WHERE price >= ? AND price <= ?`;
  console.log('minprice: ', minPrice, ' maxprice: ', maxPrice);

  db.query(query_get, [minPrice, maxPrice], (err, result) => {
    if (err) {
      console.log('Error');
    } else {
      res.json(result)
    }
  })
})

app.get('/getproducts', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const query = 'SELECT * FROM `PRODUCTS`';

  db.query(query, (err, result) => {
    if (err) {
      return res.status(500).send('Error retrieving products');
    }
    res.json(result);
  });
});

app.get('/getproductsforeditordelete', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { name } = req.query;

  if (!name) {
    return res.status(400).send({ message: 'Product name is required' });
  }

  const query = 'SELECT * FROM PRODUCTS WHERE name LIKE ?';

  db.query(query, [`%${name}%`], (err, results) => {
    if (err) {
      console.error('Error fetching products:', err);
      return res.status(500).send({ message: 'Database query failed' });
    }

    if (results.length === 0) {
      return res.status(404).send({ message: 'Product not found' });
    }

    res.send(results);
  });
});

//for admin page 
app.get('/getproductsforeditordeletebycategory', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { category } = req.query;

  if (!category) {
    return res.status(400).send({ message: 'Product name is required' });
  }

  const query = 'SELECT * FROM PRODUCTS WHERE category LIKE ?';

  db.query(query, [`%${category}%`], (err, results) => {
    if (err) {
      console.error('Error fetching products:', err);
      return res.status(500).send({ message: 'Database query failed' });
    }

    if (results.length === 0) {
      return res.status(404).send({ message: 'Product not found' });
    }

    res.send(results);
  });
});



// const menuItems = JSON.parse(fs.readFileSync('./menuitems.json', 'utf-8'));
// console.log(menuItems[2].title);

// const query12 = `INSERT INTO Products (name, description, category, price,ratings,qnty,prod_sold, imgurl) VALUES (? , ?, ?,?, ?, 20,0,?)`;

// for (const items of menuItems) {
//   let {
//     title,
//     description,
//     price,
//     currency,
//     category,
//     dietary,
//     photo
//   } = items;
//   let url = photo.imageUrl;
//   console.log("url: ", url);
//   db.execute(query12,[title,description,category,price,currency,url],(err,result)=>{
//     if(err){
//       console.log(err)
//     }else{
//       console.log('Data inserted successfully!');

//     }
// });
// }

app.delete('/delete-product/:id', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const productId = req.params.id;
  const sql = 'DELETE FROM PRODUCTS WHERE id = ?';

  db.query(sql, [productId], (err, result) => {
    if (err) {
      return res.status(500).send('Error deleting product');
    }
    res.send(`Deleted product with ID: ${productId}`);
  });
});

app.delete("/deletefromcart/:id/:cartid", (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { id, cartid } = req.params;
  console.log('Deleting product with cart id: ', id)
  const del = `DELETE FROM cartItems WHERE id = ? AND cart_id = ?`;
  db.query(del, [id, cartid], (err, result) => {
    if (err) {
      console.error('Error deleting product:', err.message);
      res.status(500).json({
        message: 'Error deleting product from cart',
        error: err.message
      });
    } else {
      res.status(200).json({
        message: 'Product deleted'
      })
    }
  })
})

app.get('/topselling', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const query = `SELECT * FROM PRODUCTS ORDER BY prod_sold DESC LIMIT 6`;
  db.query(query, (err, result) => {
    if (err) throw err;
    res.send(result);
  })
})
app.get('/lunch', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const category = req.query.category; // Get category from query parameters
  const query = `SELECT * FROM PRODUCTS WHERE category = ? LIMIT 6`;
  db.query(query, [category], (err, result) => {
    if (err) throw err;
    res.send(result);
  });
});



//get orders that have placed by the user
app.get('/getorders', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { userrid } = req.query;
  const getorder = `WITH last_order AS (
    SELECT o.order_id
    FROM users u
    INNER JOIN users_Orders uo ON uo.id = u.id 
    INNER JOIN Orders o ON o.order_id = uo.order_id
    WHERE u.id = ?
    ORDER BY o.order_date DESC,o.order_Time DESC
    LIMIT 1
  )
  SELECT p.*
  FROM orderProducts op
  INNER JOIN PRODUCTS p ON op.id = p.id
  WHERE op.order_id = (SELECT order_id FROM last_order)`
  console.log('getting order of order id: ', userrid);

  db.query(getorder, [userrid], (err, result) => {
    db = mysql.createConnection(dbConfig); // Recreate the connection
    if (err) {
      res.status(500).json({
        message: 'Error getting order',
        error: err.message
      });
    } else {
      res.json(result);
    }
  })
})


app.get('/orders', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const userid = parseInt(req.query.userid);

  // SQL query to get the latest order for a specific user
  const query = `
    SELECT o.* 
    FROM users u 
    INNER JOIN Orders o ON u.id = o.id 
    WHERE u.id = 3 
    ORDER BY o.order_date DESC, o.order_time DESC 
    LIMIT 1`;

  db.query(query, [userid], (err, result) => {
    if (err) {
      // Handle the error
      console.error('Error executing query:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }

    if (result.length === 0) {
      // No orders found for the specified user
      return res.status(404).json({ message: 'No orders found for this user.' });
    }

    // Successfully retrieved the latest order
    res.json(result[0]); // Send the latest order as the response
  });
});

app.get('/getorderedproducts', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { userid } = req.query;

  console.log('userid arahi hai ? ', userid);
  const getproducts = `SELECT p.*, op.quantity
FROM orderProducts op
INNER JOIN Orders o ON o.order_id = op.order_id
INNER JOIN PRODUCTS p ON p.id = op.id
WHERE o.order_id = (
    SELECT o.order_id
    FROM users u
    INNER JOIN Orders o ON u.id = o.id
    WHERE u.id = ?
    ORDER BY o.order_date DESC, o.order_time DESC
    LIMIT 1
)`;
  db.query(getproducts, [userid], (err, result) => {
    if (err) {
      // Handle the error
      console.error('Error executing query:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }

    if (result.length === 0) {
      // No orders found for the specified user
      return res.status(404).json({ message: 'No PRODUCTS found for this user.' });
    }

    // Successfully retrieved the latest order
    res.json(result); // Send the latest order as the response
  });
})

app.get('/admin/orders', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const getorders = `select o.*,u.name,u.email,d.delivery_address,delivery_city,d.payment_method,d.postal_code,d.phoneNo from Orders o inner join users u on o.id = u.id inner join Delivery d on u.id = d.id`;
  db.query(getorders, (err, result) => {
    if (err) {
      res.status(400).json({ message: 'Error fetching PRODUCTS' });
    } else {
      console.log(result);
      res.json(result);
    }
  })
})

app.get('/orders/product', (req, res) => {
  const { orderId } = req.query;
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const getallproducts = `select o.order_id,op.quantity,p.name,p.category,p.price,p.imgdata,imgurl from PRODUCTS p inner join orderProducts op on op.id = p.id inner join Orders o on o.order_id = op.order_id where o.order_id = ?`;
  db.query(getallproducts, [orderId], (err, result) => {
    if (err) {
      res.status(400).json({ message: 'Error fetching products' });
    } else {
      console.log(result);
      res.json(result);
    }
  })
})

app.put('/updateProduct', (req, res) => {
  db = mysql.createConnection(dbConfig); // Recreate the connection
  const { id, name, description, category, price, qnty, imgurl } = req.body;
  console.log(id, name, description, category, price, qnty);
  const update = `UPDATE PRODUCTS SET name = ?,description = ?,category = ?,price=?,qnty=?,imgurl=? where id = ?`
  db.query(update, [name, description, category, price, qnty, imgurl, id], (err, result) => {
    if (err) {
      res.status(404).json(err);
    } else {
      res.json(result);
    }
  })
})

const port = process.env.PORT;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
