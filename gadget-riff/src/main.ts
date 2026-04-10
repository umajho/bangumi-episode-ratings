import { processRootPage } from "./page-processors/root";

async function main() {
  // 不在超展开页面执行。
  // NOTE: 在超展开页面，即使已经登录，`window.CHOBITS_UID` 也没有被定义。
  if (/^\/rakuen(\/|$)/.test(window.location.pathname)) {
    return;
  }

  await migrate();
  await initializeStore();

  if ((await setUpToken()).shouldCloseWindow) {
    window.close();
    return;
  }

  switch (detectPageType()) {
    case "root": {
      await processRootPage();
      break;
    }
    case "subject": {
      // TODO
      break;
    }
    case "subject_ep_list": {
      // TODO
      break;
    }
    case "ep": {
      // TODO
      break;
    }
    default:
      // no-op
  }
}

async function migrate() {
  // noop
}

async function initializeStore() {
  // TODO
}

async function setUpToken(): Promise<{ shouldCloseWindow: boolean }> {
  // TODO

  return { shouldCloseWindow: false };
}

type BANGUMI_PAGE_TYPE = "root" | "subject" | "subject_ep_list" | "ep";

function detectPageType(): BANGUMI_PAGE_TYPE | null {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  if (!pathParts.length) {
    return "root";
  } else if (pathParts.length === 2 && pathParts[0] === "subject") {
    return "subject";
  } else if (
    pathParts.length === 3 &&
    pathParts[0] === "subject" && pathParts[2] === "ep"
  ) {
    return "subject_ep_list";
  } else if (pathParts.length === 2 && pathParts[0] === "ep") {
    return "ep";
  } else {
    return null;
  }
}

main();
