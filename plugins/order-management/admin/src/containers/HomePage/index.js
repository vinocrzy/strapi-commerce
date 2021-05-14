/*
 *
 * HomePage
 *
 */

import React, { useState, useEffect, memo } from "react";
// import PropTypes from 'prop-types';
import pluginId from "../../pluginId";
import { request } from "strapi-helper-plugin";

import { Container, Block } from "../../components/OrderStyled";
import OrderTable from "../../components/OrderTable";
import { InputText, Button, Padded } from "@buffetjs/core";

const HomePage = () => {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const loadOrders = async () => {
      const response = await request(`/orders`, {
        method: "GET",
      });
      setOrders(response);
    };
    loadOrders();
  }, []);

  return (
    <div className="row">
      <div className="col-md-12">
        <Container>
          <Block>
            <h1>Order Reports</h1>
            {/* <p>Save your private key here</p> */}
            {orders.length > 0 && <OrderTable orders={orders} />}
          </Block>
        </Container>
      </div>
    </div>
  );
};

export default memo(HomePage);
