"use client";

import { useEffect } from "react";
import { isStoreApp } from "@/lib/appMode";

// Retient, dès la première page, que le site tourne dans l'app des stores.
export function StoreAppDetector() {
  useEffect(() => {
    isStoreApp();
  }, []);
  return null;
}
