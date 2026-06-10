// ============================================
// utils/api.js — 小程序 API 请求封装
// 复制到小程序项目 utils/ 目录下
// ============================================

const API_BASE = "https://usedfarmmach.com/api/miniapp";
const API_KEY = "shennong_miniapp_2026_key_x8k2mP9vLqR7wT3y";

/**
 * 通用请求方法
 */
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: API_BASE + url,
      method: options.method || "GET",
      header: {
        "Content-Type": "application/json",
        "x-miniapp-key": API_KEY,
        ...(options.header || {}),
      },
      data: options.data,
      timeout: options.timeout || 15000,
      success(res) {
        if (res.statusCode === 200 && res.data.success) {
          resolve(res.data.data);
        } else {
          reject(res.data.error || "请求失败");
        }
      },
      fail(err) {
        reject(err.errMsg || "网络错误");
      },
    });
  });
}

/**
 * 上传文件到 OSS
 * @param {string} filePath - wx.chooseImage/wx.chooseVideo 返回的临时路径
 * @param {string} folder - 上传子目录
 * @returns {Promise<{url, key, type}>}
 */
function uploadFile(filePath, folder = "miniapp") {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: API_BASE + "/upload",
      filePath: filePath,
      name: "file",
      header: { "x-miniapp-key": API_KEY },
      formData: { folder },
      timeout: 60000, // 60s for large files
      success(res) {
        try {
          const data = JSON.parse(res.data);
          if (data.success) resolve(data.data);
          else reject(data.error || "上传失败");
        } catch (e) {
          reject("解析响应失败");
        }
      },
      fail(err) {
        reject(err.errMsg || "上传失败");
      },
    });
  });
}

// ========== 对外接口 ==========

/** 获取产品列表 */
export function getProducts(params = {}) {
  const query = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return request("/products?" + query);
}

/** 获取品牌和品类列表 */
export function getBrandsAndCategories() {
  return request("/brands-categories");
}

/** 发布新产品 */
export function createProduct(data) {
  return request("/products", { method: "POST", data });
}

/** 上传单张图片 */
export function uploadImage(filePath) {
  return uploadFile(filePath, "miniapp");
}

/** 上传视频 */
export function uploadVideo(filePath) {
  return uploadFile(filePath, "miniapp");
}

/** 批量上传图片（顺序上传） */
export async function uploadImages(filePaths) {
  const results = [];
  for (const fp of filePaths) {
    const res = await uploadImage(fp);
    results.push(res.url);
  }
  return results;
}
