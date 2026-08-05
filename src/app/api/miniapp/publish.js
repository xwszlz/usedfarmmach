// ============================================
// 小程序发布产品页面 — 示例代码
// 复制到小程序 pages/publish/ 目录
// ============================================

import { getBrandsAndCategories, uploadImages, uploadVideo, createProduct } from "../../utils/api";

Page({
  data: {
    // 表单数据
    brands: [],
    categories: [],
    brandIndex: 0,
    categoryIndex: 0,
    modelName: "",
    priceCny: "",
    year: new Date().getFullYear(),
    workingHours: "",
    condition: "good",
    location: "",
    descriptionZh: "",

    // 媒体
    images: [], // [{path, url}]
    video: null, // {path, url}

    // 状态
    uploading: false,
    submitting: false,
    conditions: [
      { value: "excellent", label: "优" },
      { value: "good", label: "良" },
      { value: "fair", label: "一般" },
      { value: "poor", label: "差" },
    ],
  },

  async onLoad() {
    // 加载品牌品类下拉
    try {
      const data = await getBrandsAndCategories();
      this.setData({ brands: data.brands, categories: data.categories });
    } catch (e) {
      wx.showToast({ title: "加载品牌失败", icon: "none" });
    }
  },

  // 选择品牌
  onBrandChange(e) {
    this.setData({ brandIndex: e.detail.value });
  },

  // 选择品类
  onCategoryChange(e) {
    this.setData({ categoryIndex: e.detail.value });
  },

  // 拍照/选图
  onChooseImage() {
    const that = this;
    wx.chooseImage({
      count: 9,
      sizeType: ["compressed"],
      sourceType: ["camera", "album"],
      success(res) {
        const newImages = res.tempFilePaths.map((path) => ({ path, url: "" }));
        that.setData({ images: [...that.data.images, ...newImages] });
      },
    });
  },

  // 删除图片
  onRemoveImage(e) {
    const idx = e.currentTarget.dataset.index;
    const images = this.data.images;
    images.splice(idx, 1);
    this.setData({ images });
  },

  // 拍视频
  onChooseVideo() {
    const that = this;
    wx.chooseVideo({
      maxDuration: 60,
      sourceType: ["camera", "album"],
      success(res) {
        that.setData({ video: { path: res.tempFilePath, url: "" } });
      },
    });
  },

  // 提交发布
  async onSubmit() {
    const data = this.data;
    if (!data.modelName || !data.priceCny || !data.location) {
      wx.showToast({ title: "请填写型号/价格/位置", icon: "none" });
      return;
    }

    this.setData({ uploading: true, submitting: true });

    try {
      // 1. 上传图片
      let imageUrls = [];
      if (data.images.length > 0) {
        wx.showLoading({ title: "上传图片中..." });
        const paths = data.images.map((img) => img.path);
        imageUrls = await uploadImages(paths);
      }

      // 2. 上传视频（如果有）
      let videoUrls = [];
      if (data.video && data.video.path) {
        wx.showLoading({ title: "上传视频中..." });
        const res = await uploadVideo(data.video.path);
        videoUrls = [res.url];
      }

      // 3. 创建产品
      wx.showLoading({ title: "发布中..." });

      const brand = data.brands[data.brandIndex];
      const category = data.categories[data.categoryIndex];

      await createProduct({
        brandId: brand?.value,
        categoryId: category?.value,
        modelName: data.modelName,
        priceCny: parseFloat(data.priceCny),
        year: data.year,
        workingHours: data.workingHours ? parseInt(data.workingHours) : null,
        condition: data.condition,
        location: data.location,
        descriptionZh: data.descriptionZh,
        images: imageUrls,
        videos: videoUrls,
      });

      wx.hideLoading();
      wx.showToast({ title: "发布成功！网站已同步", icon: "success" });

      // 重置表单
      this.setData({
        modelName: "", priceCny: "", workingHours: "",
        location: "", descriptionZh: "",
        images: [], video: null,
        uploading: false, submitting: false,
      });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: typeof e === "string" ? e : "发布失败", icon: "none" });
      this.setData({ uploading: false, submitting: false });
    }
  },
});
