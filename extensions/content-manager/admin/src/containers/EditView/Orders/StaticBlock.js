import React from "react";
import { currency } from "./functions";

export default function StaticBlock({ title, value, icon, isCurrency }) {
  const cardStyle = {
    padding: "15px",
    borderRadius: "2px",
  };
  return (
    <div className="static-Wrapper col-6">
      <div className="content-container" style={cardStyle}>
        <h4 style={{ marginBottom: "25px", color: "#5b626f" }}>{title} : </h4>

        <h4 className={`title`}>
          {isCurrency ? currency.format(value) : value}
        </h4>
      </div>

      <br />
    </div>
  );
}
