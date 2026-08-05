const fs = require("fs");
const p = "/d/神雕农机/usedfarmmach/messages/hi.json";
const block = {
  successTitle: "Email Verified",
  successMessage: "Your email has been verified. You can now use features like password recovery.",
  successMessageWithGift: "Your email is verified and you earned {amount} credit reward!",
  expiredTitle: "Link Expired",
  expiredMessage: "This verification link has expired or is invalid. Please request a new verification email.",
  invalidTitle: "Invalid Link",
  invalidMessage: "The verification link is invalid or already used. Please request a new verification email.",
  gotoAccount: "Go to Account",
  backHome: "Back to Home",
};
const obj = JSON.parse(fs.readFileSync(p, "utf8"));
if (!obj.auth) obj.auth = {};
if (!obj.auth.verifyEmail) {
  obj.auth.verifyEmail = block;
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
  console.log("hi.json: verifyEmail added");
} else {
  console.log("hi.json: verifyEmail already present, skipped");
}
