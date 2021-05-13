import React from "react";
import { Link } from "react-router-dom";

import Logo from "../../../assets/images/logo-strapi.png";

import Wrapper from "./Wrapper";

const LeftMenuHeader = () => (
  <Wrapper>
    <Link to="/" className="leftMenuHeaderLink">
      {/* <img className="projectName" src={Logo} alt="Logo" /> */}
    </Link>
  </Wrapper>
);

export default LeftMenuHeader;
