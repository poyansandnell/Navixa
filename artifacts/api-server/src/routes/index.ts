import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profileRouter from "./profile";
import matchmakingRouter from "./matchmaking";
import matchesRouter from "./matches";
import socialRouter from "./social";
import historyRouter from "./history";
import questsRouter from "./quests";
import shopRouter from "./shop";
import tournamentsRouter from "./tournaments";
import notificationsRouter from "./notifications";
import accountRouter from "./account";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/profile", profileRouter);
router.use("/matchmaking", matchmakingRouter);
router.use("/matches", matchesRouter);
router.use("/social", socialRouter);
router.use("/history", historyRouter);
router.use("/quests", questsRouter);
router.use("/shop", shopRouter);
router.use("/tournaments", tournamentsRouter);
router.use("/notifications", notificationsRouter);
router.use("/account", accountRouter);
router.use("/admin", adminRouter);

export default router;
