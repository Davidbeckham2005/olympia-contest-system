import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requirePin } from "../middleware/requirePin.js";
import { upload, uploadMemory, uploadImport } from "../middleware/upload.js";
import * as admin from "../controllers/admin.controller.js";

const router = Router();

    router.post("/login", asyncHandler(admin.login));
router.get("/state", requirePin, asyncHandler(admin.getState));
router.post("/settings", requirePin, asyncHandler(admin.saveSettings));
router.post("/contestants", requirePin, asyncHandler(admin.createContestant));
router.post("/contestants/import", requirePin, uploadImport.single("file"), asyncHandler(admin.importContestants));
router.post("/contestants/bulk-delete", requirePin, asyncHandler(admin.deleteContestants));
router.delete("/contestants/:id", requirePin, asyncHandler(admin.deleteContestant));
router.post("/divide-teams", requirePin, asyncHandler(admin.divideTeams));
router.post("/assign-teams", requirePin, asyncHandler(admin.assignTeams));
router.post("/reset", requirePin, asyncHandler(admin.reset));
router.post("/teams", requirePin, asyncHandler(admin.saveTeams));
router.post("/questions/main", requirePin, asyncHandler(admin.saveMainQuestions));
router.post("/questions/ve-dich/import", requirePin, uploadImport.single("file"), asyncHandler(admin.importVeDichQuestions));
router.post("/khoi-dong-answer-seconds", requirePin, asyncHandler(admin.setKhoiDongAnswerSeconds));
router.post("/khoi-dong-timer-seconds", requirePin, asyncHandler(admin.setKhoiDongTimerSeconds));
router.post("/upload", requirePin, uploadMemory.single("file"), asyncHandler(admin.uploadMedia));
router.delete("/media/:id", requirePin, asyncHandler(admin.deleteMedia));
router.post("/sounds/:slot", requirePin, upload.single("file"), asyncHandler(admin.uploadSound));
router.delete("/sounds/:slot", requirePin, asyncHandler(admin.deleteSound));

export default router;
