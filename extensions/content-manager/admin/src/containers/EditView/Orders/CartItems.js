import React from "react";

// import "./CartItems.css";

import { currency } from "./functions";

export default function CartItems({ cartItems }) {
  //   console.log(cartItems);

  const cardStyle = {
    boxShadow: "0 2px 4px #e3e9f3",
    padding: "15px",
    borderRadius: "2px",
  };

  return (
    <div className="cart-Wrapper col-12">
      <div className="cart-container" style={{ padding: "15px" }}>
        <h4
          className={`title`}
          style={{ marginBottom: "25px", color: "#5b626f" }}
        >
          Products on this Order :
        </h4>

        <div className="cart-items ">
          <div className="row">
            {cartItems.map((item, index) => (
              <div className="col-6" key={index}>
                <div className="product-items card" style={cardStyle}>
                  <h4>{item.product.name}</h4>
                  <p className="price">{currency.format(item.product.price)}</p>
                  <p>Quantity : {item.quantity}</p>
                  <p>
                    Total :{currency.format(item.product.price)} X{" "}
                    {item.quantity} ={" "}
                    {currency.format(item.product.price * item.quantity)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <br />
    </div>
  );
}
