"use strict";
const { sanitizeEntity } = require("strapi-utils");

const stripe = require("stripe")(process.env.STRIPE_PK);

/**
 * Given a dollar amount number, convert it to it's value in cents
 * @param {Int} number
 */
const fromDecimalToInt = (number) => parseInt(number * 100);

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

/**
 * Retrieve the real product here ?
 * @param {String} slug
 * @returns
 */
const isRealProduct = async (slug) => {
  const realProduct = await strapi.services.product.findOne({ slug: slug });

  return realProduct;
};

module.exports = {
  /**
   * Only send back orders from you
   * @param {*} ctx
   */
  async find(ctx) {
    const { user } = ctx.state;
    let entities;
    if (ctx.query._q) {
      entities = await strapi.services.order.search({
        ...ctx.query,
        user: user.id,
      });
    } else {
      entities = await strapi.services.order.find({
        ...ctx.query,
        user: user.id,
      });
    }

    return entities.map((entity) =>
      sanitizeEntity(entity, { model: strapi.models.order })
    );
  },
  /**
   * Retrieve an order by id, only if it belongs to the user
   */
  async findOne(ctx) {
    const { id } = ctx.params;
    const { user } = ctx.state;

    const entity = await strapi.services.order.findOne({ id, user: user.id });
    return sanitizeEntity(entity, { model: strapi.models.order });
  },

  /**
   * Create Orders
   * @param {*} ctx
   * @returns session
   */

  async create(ctx) {
    const BASE_URL = ctx.request.headers.origin || "http://localhost:3000"; //So we can redirect back

    const { cartItems, address, name, email, phone } = ctx.request.body;

    if (!cartItems) {
      return res.status(400).send({ error: "Please add a cart items to body" });
    }

    var i;

    const cartArray = [];
    const line_items = [];

    var totalAmount = 0;

    const { user } = ctx.state; //From JWT

    for (i = 0; i < cartItems.length; i++) {
      var realProduct = await isRealProduct(cartItems[i].slug);

      var tempData = {
        product: realProduct,
        quantity: cartItems[i].quantity,
      };

      var tempLineItems = {
        price_data: {
          currency: "inr",
          product_data: {
            name: realProduct.name,
          },
          unit_amount: fromDecimalToInt(realProduct.price),
        },
        quantity: cartItems[i].quantity,
      };

      if (realProduct) {
        cartArray.push(tempData);
        line_items.push(tempLineItems);
        totalAmount += realProduct.price * cartItems[i].quantity;
      }
    }

    var addressTxt = `${address.line1}, ${
      address.line2 ? address.line2 + "," : ""
    } ${address.city} - ${address.postal_code},${address.state},${
      address.country
    }`;

    // console.log({ cartArray, totalAmount, user, address, addressTxt });

    // const session = await stripe.checkout.sessions.create({
    //   payment_method_types: ["card"],
    //   line_items: line_items,
    //   customer_email: user.email, //Automatically added by Magic Link
    //   mode: "payment",
    //   success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    //   cancel_url: BASE_URL,
    // });

    // console.log(paymentIntent);

    //TODO Create Temp Order here
    const newOrder = await strapi.services.order.create({
      user: user.id,
      total: totalAmount,
      Cart: cartArray,
      address: addressTxt,
      userEmail: email,
      userPhone: phone,
      userName: name,
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: fromDecimalToInt(totalAmount),
      currency: "inr",
      metadata: {
        Customer_Name: name,
        Customer_Email: email,
        User_Phone: phone,
        Site_Url: BASE_URL,
        Order_Id: `OrderId #${newOrder.id}`,
      },
      receipt_email: email,
      description: `Pashudh OrderId #${newOrder.id}`,
    });

    const updateOrder = await strapi.services.order.update(
      {
        id: newOrder.id,
      },
      {
        transactionId: paymentIntent.id,
      }
    );

    // console.log(newOrder);

    return {
      client_secret: paymentIntent.client_secret,
    };

    // return { status: true };
  },

  /**
   * Payment Confirm for the order
   * @param {*} ctx
   * @returns
   */

  async confirm(ctx) {
    const { transactionId } = ctx.request.body;

    const paymentIntent = await stripe.paymentIntents.retrieve(transactionId);

    // console.log("verify session", paymentIntent.status);

    if (paymentIntent.status === "succeeded") {
      //Update order
      const newOrder = await strapi.services.order.update(
        {
          transactionId,
        },
        {
          status: "paid",
        }
      );
      return sanitizeEntity(newOrder, { model: strapi.models.order });
    } else {
      ctx.throw(
        400,
        "It seems like the order wasn't verified, please contact support"
      );
    }
  },
};
