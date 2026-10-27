import React, {  useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from "three";
import World3D from "./World3D.jsx";
import { OBS, FRAGMENTS, ZONENAMES } from "./data.js";

const LABELS = {
  sky: "Sky",
  north: "North Pool",
  tree: "Survivor Tree",
  street: "Greenwich Street"
};

const Icon = ({ name }) => {
  const paths = {
    pause: "M7 5h4v14H7zM15 5h4v14h-4z",
    play: "m7 4 13 8-13 8z",
    camera: "M4 7h3l2-3h6l2 3h3v12H4z M12 10a4 4 0 1 0 0 8a4 4 0 1 0 0-8",
    reset: "M3 12a9 9 0 1 0 3-7L3 8m0-5v5h5",
    info: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 10v7M12 7v1",
  };

  return (
    <svg
      widht = "17"
      height = "17"
      viewBox = "0 0 24 24"
      stroke = "currentColor"
      strokeWidth = "1.8"
      strokeLinecap = "round"
      strokeLinejoin = "round"
      fill = "none"
    >
      <path d={paths[name]} />
    </svg>
  );
};

const empties = {
  sky: "day or night", 
  north: "pool", 
  tree: "tree",
  street: "street", 
};

c = 
function Slot({ id, placed, onPlace, selected, anchorRef }) {
  return (
    <button
      ref = {anchorRef}
      className = {"slot " + id + (placed ? " filled" : "")}
      title = {"Complete" + LABELS[id]}
      onDragOver = {(e) => e.preventDefault()}
      onDragEnter = {(e) => e.currentTarget.classList.add("dragover")}
      onDragLeave = {(e) => e.currentTarget.classList.remove("dragover")}
      onDrop = {(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove("dragover");
        onPlace(e.dataTransfer.getData("text/plain"), id);
      }}
    >
      <span className="slot-icon">
        {id === "sky" ? "☼" : id === "north" ? "≈" : id === "tree" ? "♧" : "⌁"}
      </span>
      <span className="slot-inner">{empties[id]}</span>
    </button>
  )
}


