export function createProjectWriteFailureState(error, resourceLabel, offlineState) {
  if (error?.status === 403) {
    return {
      status: "auth-required",
      mode: "local",
      label: `${resourceLabel} 需要协同登录`,
      detail: "当前部署要求已登录研究员、审阅员或负责人后才能同步项目写入；本地草稿仍可继续使用。",
      authenticationRequired: true
    };
  }
  return offlineState();
}
