"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/generate.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));

// src/github-api.ts
function createMockStats(username, featuredRepoName, timezoneOffsetMinutes = 0) {
  const weeks = [];
  const now = /* @__PURE__ */ new Date();
  const today = new Date(now.getTime() + timezoneOffsetMinutes * 60 * 1e3);
  for (let w = 25; w >= 0; w--) {
    const days = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(today);
      date.setDate(date.getDate() - (w * 7 + d));
      const dateStr = date.toISOString().split("T")[0];
      const pseudoVal = (Math.sin(w * 3 + d * 7) + 1) / 2;
      let count = 0;
      let level = "NONE";
      if (pseudoVal > 0.82) {
        count = Math.floor(pseudoVal * 12) + 5;
        level = "FOURTH_QUARTILE";
      } else if (pseudoVal > 0.62) {
        count = Math.floor(pseudoVal * 8) + 2;
        level = "THIRD_QUARTILE";
      } else if (pseudoVal > 0.42) {
        count = Math.floor(pseudoVal * 4) + 1;
        level = "SECOND_QUARTILE";
      } else if (pseudoVal > 0.25) {
        count = 1;
        level = "FIRST_QUARTILE";
      }
      days.push({
        contributionCount: count,
        contributionLevel: level,
        date: dateStr
      });
    }
    weeks.push({ contributionDays: days });
  }
  const defaultLanguages = [
    { name: "TypeScript", percentage: 46 },
    { name: "Rust", percentage: 24 },
    { name: "Python", percentage: 16 },
    { name: "Go", percentage: 9 },
    { name: "Shell", percentage: 5 }
  ];
  const defaultRepo = {
    name: featuredRepoName || "CathodeRayStats",
    description: "CathodeRayStats - Animated retro CRT television SVG widget displaying live stats, languages, and activity.",
    stars: 342,
    forks: 48,
    primaryLanguage: "TypeScript"
  };
  return {
    username,
    name: username,
    totalContributions: 2481,
    totalCommits: 1894,
    totalPullRequests: 142,
    followers: 89,
    languages: defaultLanguages,
    featuredRepo: defaultRepo,
    activityWeeks: weeks
  };
}
function calculateLanguageStats(repoNodes) {
  const totals = {};
  let overallSize = 0;
  for (const repo of repoNodes) {
    if (!repo.languages?.edges) continue;
    for (const edge of repo.languages.edges) {
      const name = edge.node.name;
      const size = edge.size;
      overallSize += size;
      if (!totals[name]) {
        totals[name] = { size: 0, color: edge.node.color };
      }
      totals[name].size += size;
    }
  }
  if (overallSize === 0) {
    return [
      { name: "TypeScript", percentage: 50 },
      { name: "JavaScript", percentage: 30 },
      { name: "HTML/CSS", percentage: 20 }
    ];
  }
  const sorted = Object.entries(totals).map(([name, data]) => ({
    name,
    percentage: Math.round(data.size / overallSize * 100),
    color: data.color
  })).filter((item) => item.percentage > 0).sort((a, b) => b.percentage - a.percentage);
  const top5 = sorted.slice(0, 5);
  const topSum = top5.reduce((acc, curr) => acc + curr.percentage, 0);
  if (topSum > 0 && topSum < 95) {
    top5.push({ name: "Other", percentage: 100 - topSum, color: void 0 });
  }
  return top5.slice(0, 5);
}
async function fetchFromGraphQL(username, token, featuredRepo) {
  const query = `
    query($username: String!) {
      user(login: $username) {
        name
        followers {
          totalCount
        }
        contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                contributionLevel
                date
              }
            }
          }
        }
        pinnedItems(first: 6, types: [REPOSITORY]) {
          nodes {
            ... on Repository {
              name
              description
              stargazerCount
              forkCount
              primaryLanguage {
                name
              }
            }
          }
        }
        repositories(first: 30, ownerAffiliations: OWNER, isFork: false, orderBy: {field: STARGAZERS, direction: DESC}) {
          nodes {
            name
            description
            stargazerCount
            forkCount
            primaryLanguage {
              name
            }
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
              edges {
                size
                node {
                  name
                  color
                }
              }
            }
          }
        }
      }
    }
  `;
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "CathodeRayStats-action",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables: { username } })
  });
  if (!response.ok) {
    throw new Error(`GitHub GraphQL API error: ${response.status} ${response.statusText}`);
  }
  const json = await response.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`GraphQL Errors: ${json.errors.map((e) => e.message).join(", ")}`);
  }
  const user = json.data?.user;
  if (!user) {
    throw new Error(`User "${username}" not found on GitHub.`);
  }
  const repos = user.repositories?.nodes || [];
  const pinned = user.pinnedItems?.nodes || [];
  let selectedRepo;
  if (featuredRepo) {
    const matched = repos.find((r) => r.name.toLowerCase() === featuredRepo.toLowerCase()) || pinned.find((r) => r.name.toLowerCase() === featuredRepo.toLowerCase());
    if (matched) {
      selectedRepo = {
        name: matched.name,
        description: matched.description || "",
        stars: matched.stargazerCount,
        forks: matched.forkCount,
        primaryLanguage: matched.primaryLanguage?.name
      };
    } else {
      selectedRepo = {
        name: featuredRepo,
        description: "Selected featured repository",
        stars: 0,
        forks: 0
      };
    }
  } else if (pinned.length > 0 && pinned[0]?.name) {
    selectedRepo = {
      name: pinned[0].name,
      description: pinned[0].description || "",
      stars: pinned[0].stargazerCount,
      forks: pinned[0].forkCount,
      primaryLanguage: pinned[0].primaryLanguage?.name
    };
  } else if (repos.length > 0) {
    selectedRepo = {
      name: repos[0].name,
      description: repos[0].description || "",
      stars: repos[0].stargazerCount,
      forks: repos[0].forkCount,
      primaryLanguage: repos[0].primaryLanguage?.name
    };
  } else {
    selectedRepo = {
      name: `${username}-profile`,
      description: "GitHub profile activity & repositories",
      stars: 1,
      forks: 0
    };
  }
  const langStats = calculateLanguageStats(repos);
  const calendar = user.contributionsCollection?.contributionCalendar;
  const weeks = calendar?.weeks || [];
  return {
    username,
    name: user.name || username,
    totalContributions: calendar?.totalContributions || 0,
    totalCommits: user.contributionsCollection?.totalCommitContributions || 0,
    totalPullRequests: user.contributionsCollection?.totalPullRequestContributions || 0,
    followers: user.followers?.totalCount || 0,
    languages: langStats,
    featuredRepo: selectedRepo,
    activityWeeks: weeks
  };
}
async function fetchFromRestApi(username, featuredRepo) {
  const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
    headers: { "User-Agent": "CathodeRayStats-action" }
  });
  if (!userRes.ok) {
    throw new Error(`GitHub REST user fetch error: ${userRes.status}`);
  }
  const userData = await userRes.json();
  const reposRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=30&sort=pushed`, {
    headers: { "User-Agent": "CathodeRayStats-action" }
  });
  const reposData = reposRes.ok ? await reposRes.json() : [];
  let selectedRepo = {
    name: featuredRepo || (reposData[0]?.name ?? `${username}-repo`),
    description: reposData[0]?.description || "Public GitHub Repository",
    stars: reposData[0]?.stargazers_count ?? 0,
    forks: reposData[0]?.forks_count ?? 0,
    primaryLanguage: reposData[0]?.language
  };
  if (featuredRepo) {
    const matched = reposData.find((r) => r.name.toLowerCase() === featuredRepo.toLowerCase());
    if (matched) {
      selectedRepo = {
        name: matched.name,
        description: matched.description || "",
        stars: matched.stargazers_count ?? 0,
        forks: matched.forks_count ?? 0,
        primaryLanguage: matched.language
      };
    }
  }
  const mockFallback = createMockStats(username, selectedRepo.name);
  return {
    ...mockFallback,
    name: userData.name || username,
    followers: userData.followers || 0,
    featuredRepo: selectedRepo
  };
}
async function fetchGitHubData(username, token, featuredRepo, timezoneOffsetMinutes = 0) {
  if (token && token.trim().length > 0) {
    try {
      return await fetchFromGraphQL(username, token, featuredRepo);
    } catch (err) {
      console.warn(`[WARN] GraphQL fetch failed (${err.message}), attempting REST fallback...`);
    }
  }
  try {
    return await fetchFromRestApi(username, featuredRepo);
  } catch (err) {
    console.warn(`[WARN] REST fetch failed (${err.message}), using deterministic mock data...`);
    return createMockStats(username, featuredRepo, timezoneOffsetMinutes);
  }
}

// src/font-base64.ts
var VT323_FONT_BASE64 = "d09GMgABAAAAAEYQABEAAAABK5AAAEWsAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGlQbh0AchXIGYACFAAh6CZoWEQgKhI9gg8MpC4NYAAE2AiQDhxwEIAWDMAeFWAyBGFtcAlHBjr0E4g4oSA8j7mcjbLcjFBLUMyMD9WSvtpL9f0LSMYYb9gGovPKHDMEVkJARXspA5lSu3XPl1xG3HK2BjXBsidyficUR3s7JIhkS3kIh7T22sUbaOPQzxMUyzz6VVl75/wxdOUeyVgx0ON9UzsUaOsay5kti0SN+kGou2uIW2mU5dMkZ4A4rNeKE+tqvyno90DMLqIFAEh6RQhIGgCUKRQ5QbfgDQD3n9rf/9F5951Yl6QGQsZh+IL3/S/D9fr89F5fphESm/Q9NRKtKiCSX0MRSIpMp5Q2xqbmxhspf8k4VxsQuVmFzbpLRZ5b8aLLuJh5mmu7DVGFuGt4kn3unve2O5FZkjaxZW2t7e/sNKYUmhwKvNJr3+dHwI/xQ0jk8ePhv0/5i8oAkNBUq6pPUnVGxs/9iup7j9epfTnY8ERdZIgei/WwauDuIas7bhFWErjIgFHBKSMKYzjfYP39ogmq67P0noTfJeDCij0cjcV3j/6v77N0nycQfhj2A/gT2oAKoJAuMZc70O+UWzRYtnj7QP9r+94GiFEtzwkVsF7Evi2WfoJKg2WdFTVGnqyaL9xVm+fvdfXPMgmRyX7JNxSKt2tPpoSnpOvyqn1W95+7hHvBBykyp1NUEg9UDgPqTNaxh5Vi1beRymxY47S/h4caH48LzuZb+yexXh5jLgQSEboHQ6MqO79T6Tsxrt1hXG7PIF81abubl7p+0CIX8p1bjMRKrkws99FD+/15nbt97AiNwivCk4FSciqcyKXvwOK1tdlllDfc9/fd5XwW9LwnmA7IjYU5GcpVcATO/iCI8OUfTmdZEapnSENhxBPZUnEJI+jQmre1Kb4tNzixWnt3MLrPYebfPYr+N3zfLpH69N1sId5MQEsTyWrL/xopdvrWnJrlRAFd1tZRRdY9GM/fOkesmBNhsHLQwFl2qM3O7X+nRo1BqAW2Fwx7CWO/0k5ZKYULZPV+ZdLFjWKuZXTsryVcIRP5BCYsOcR66MLF0br/fL/MNuqfGJg/2TKlrcII4IqLikdQeHz/3/2OaD2M6MzrsuJnmnIA4kaGAH0fvGtP/Pkn2ZW6SXK8p6tOOCMgCS9Hr80JADQDZyCNaGGAYvFQz9J9XRTAUGWYEZqRRyBEPkUce4Z54invhNY6AtGDVWMfE3Bo2S9mLp9EjAITAEC55gEGTIzim7t1TZVY6YJXlae7OadNpkBIQDaRbMFJIhy5HNofmPpTmivb0Tj0aHgHK+mwMYhJ0PbL21/+Fl15554OPPvnsi68ksH92ViLpRKWgr3ZlgeUkI6UGCj2weBavvUdgJxDymuDuWOmEdcDSqh37JJPlGGEpPU7xxx21CBmKKa/Rf/ojDCZgN86RrrrQe7UF8GAKjhWLzAvPAXmV1NFLI/S4Uo99OUfd4mQoZtxzV38AC0nvqwldx9fFf0dF7TU7OmGOUllMMUoAAGf6EUSxwiO6+EJ0B7wVh04zE4wmAUX/sGrTn5Y8T2MqY7p2+ei6bPw2pqgKZAaqEqMX9ENpVwGblgCYIgLz79+7PlDAmw5f6dxlKpekUrtCnbo16DVUMxXizA1QEpoS7Kg9uaqA9r+euw/fHZfLF17vcFJu+3gpve3ZNVdd375SU9iZ3S6Th3I1oUP+Wc19Ru8co6LPnK10VIkeMzZHFekyZX1UgQ4TVkfltBmzPCKjxYjFtg7RZLhqYPe9yDNgt5g/dZaPT+ZfFuPFxOtXqKXekX08feLkwEnuu266LrvOuo4f8SAggou7mEt0kUtyabhUJwbp8Jy3+7Blf8nMEMrDmNCV+YSRilT22jq9b0zgLEahCvXmrT86R7aMM6EHq/ovstpwTKFhmDyE5GHn440xo4UIZuPWGI/RI5klaTMjbawrq8YYZxWkWJwtKSQBxpkWjpggvtEykEKaXIitfCbAQZuX5lbrp4BEuz3SG/BrP9wLGqU2q3cHYR6ZWYhzOocIdmjLAVMve9YMgX4DxMvYP3dS0SWdmwuchoomZppPc4rV8rsMOgWgI2sDlOGAAXtiMY6qhbRt4fvIBBZADj8RRvpfJ7WXD9qM3beHLtzFXMpVlmFXdU037ubdU/e674fAeFyM1f9Ba3mZv0irK9otC+MFzj9RdtSZxo+ZyjJg/jz6KFWAqCYqjfL+zw2+mb0PZh/C53vweUMdq0ulqbonNz56/5M1SeuK0OOxOmPfpkPuAP/XobPYSksdc8U1q2y2xRynLLTdMmsssNoF55y33FUCHbr0GTJjzoIlO/ZkDhw58+bLj78AgcKEixAp2kZzbXLfWp/ESJEqXaY8+QoUqlClWo1a9dp16tKtl6K/AQYaZKj17trgksOWOOKEo06654aPbhppp8t2uOWzOy6aZrp3HrpunvemGmWXWWaabQUNIokWFU3a9JgyYsyELSvWbBhw4s6FK09uzvAQKkiwEFF89EgQK06SeImSpcmVJVuOcsVKlMpQp1mDRq2anNWiH7U++hqswxBe2jzyyjZb7bPfXvuW5Vi2mal84zd1wfottVZNB0ES2eD/QB5S7Ncp1BP0Rpwm6clfihY8wbr/GJkdcPSaNypvvMA2/HNCj3JpC+c99A50xyYjAebQAFBmmwaGVuIFQqaP41H0OF1OsS6jR1h6/Sl68668fcLLN2W7fnUjqdfWr0kV+cphxZF6paY7MhIjFHqxkTYqN/mEvJa8E2Wx8N7IAi2+AHJKyQFPyaCX4zqlBgFNhbRhJRRfRpQGLA3O+wSyBgnz5rWqqghKwVqfI4enjz+cTZeIlRcWVcq/v6PXUXsfmV7F/NINr1O05JPQ9xG4axejbg76K2Dz4kjsJWSptt58E7QbBrjYgBJkqFWDDTWzl8/lXxkKacfRWTqt5wl7Tw5Gexg4DRe835FrHQafZ2DfcIPuIC1rWnZzrXwlac2fGygP0B5qR9itb1L9SfHPDbH3ByGnGAXQmusf/UHzMnpnPl3wwXYhKjcu+fxFvYYIIJMR8PG5zUNSQyKU8Ks4XN0QI9WS7thOf2Uoy27+Ty2zysdqdIns+hI8eRurrCbp1HNPbd/VdNf9Kj558xByPnbldTNUiofeFYunBHkg9tSaJFuogcDhdmDbhLBM1I7LRFooNyd1Hr/y9kU5+pwKcXNN040TAeeE0nxi00/Z9N60lajIJoDQ5YgYky+AHFsVHnkbiTVoiq8BT+EsKIP8V7q2jyach/Lxf9ap+MMPTqaGApXyiw0tVLygNmHUIQJ1iUQrRKFVYqE1YqN14qAN4saOYT4vipU9eRtNLficHGMbTk5UtMt+GlYVB2W/79Kb2CLHXcNbeBOXWPA2FryDBe9iwXtY8D4WfIAFH2LBR1gSPagbo6i/aSbN1NtS6/tRRS56YbrdAPSd/sqWDSHNnQcwbsO2rYbZK4VzPDjq18mxzXBVVdyaxiupdcGxV5xPJSbQTVtbpm9ORZc1GMBrdi4qSe2fRMDwXduuk9hq2TtkBnWaN7YduhN+FzXM0R7tGhblWsFp89Ptl6gctk+rNQPanRJFH5Wba53boLhwq+r2GsZFxNahC7ppDahNIiFpFS1z/bi8uC4DlbpSX6+gCas104rcAcoQHy8YJfVt/MEnB0r3g9OB1RQW0ZRDlV1kq82SU5SciyIvZOyaMQEzrwzBYZWo3CUdgjmzxd+kwSRkstmw7QyHM9iUEpxqVuyz5VKVBfTA61Y2oAwayOSMZg1wW2bLpIlGTUXg1ActOomoBO3WbR9XnOk4KnUmUCMMXOC8mLbE693t6fXYqjPvdvxhjFDdH7JslfPoys56znFMewdJaFgHLj6B55VU5Mu/bXuVvk1ewtR6sKnee8L40r1OUV1q6yAWF28aX73sa/dy11ova/QbfAvUXlvv26DxUp50oXUaS11uEyRbBg7d0akdlijx0bva1Cn0bxtMv4vqtCyUGsoRfJ+Yhyw4AMvTa3a27XxwLGzhk324d6T6og8691fldOHtpuFEq8V80G9N7ulI87h98CyZrUp5+PkIlVB8kPncfnzfWXYwv6g9NbWald3cS9MnGL8TzHTxFCORgmFjRIRoBoxJiBeCESZESGbAlHSZLvpdwACYCYRsDvSDujmMpLxCBZGKUrdExyGVqxEqGbAqoVYIRlkXoZEBm1KvZRMH1a4l6OTAblCvB1VgPxAGOXAYdBoV/SqRvdcbS5OPwcgmDHWnHV5jDLdnhwPUmDth4WC5kiiDXFkU1xbV20At47aRYedg7+CwkuiMR4vmyaJ5tmheGoCrg5uD+0pigA+L4dNi+LIYvhuAj4Ov8/Rr+uLG7CvVNp88O+t/EVXzr67Bf56GUBbkAfAPQL9AO2CgGQx1Ay0B1YJlE+z3hv9srJNJVarqN382XxnlqodvMqmlm+EtJmJz2FkKKFmFG8HNAFjouTVLCNlTBp1ZBlxhyXEJ3nKFQpbnt1SrQkTEHTK95NKB65rstHohCJKRDI8YzwVFo68hkggEdt7L4b632bcP9TaRUIfn97ZwlJVal3XdlKUMTax0+fD+qu5X4ffhqUfqhkY3aRmJ1HVJ1V1rs6fWxQd5gGbCpz9pT/aaTWlCs7cWlGK0y7kNrixiOkTF6tdFTSolKWCbVCpnpaRme84jTodo720PDQcXU9d5I/dZTWkRHeAOmX7Zd3IHd4L1cfqaBuMArSmP1/uhIibSqisVMehcrqjPdDFj2RIyWKWt3GFaEqKOJ5TX8l8iO30+Hw6pwjogd7so/LG7sD03StlDOTGcKBS024axs+3Bw5d6c38vCOWyoUEVNSR9iah+IFC0q5TLiXg8SCkLsf5pDk/ED8QOF0jWXNBVfLUTgLADbyRyJdwQFafA8VkE948zLcfzt3sb41XfK8AXLzzJhixbwmCqyPsYqNS8CoWzmrg9TBJl+l1KfJuwqVT3niIt7GJe0ORKPMe0k1r+sL64YAlbIaSEdf+zzbDDEtimj5AEXU4lPxHcbOxKOwlwqFERnayv1zFGp2BSQaRpOrFer7Dvt8hFno3ePV6IwoCtQ2tmZAsQtws781EKblMa9DyAXm9o7MXpZLEqBqTcDqyFBtCK9iWRsnCArl51Nh9Bq/ZqyoGw4pZTj2X7gpQHjExyDWqXyXEf6DIE3+kWNtl6NfPhtfS7Y6nglwJ97eCbr39uT1/Lpwyo6aSgGXo91Pw55c3gJXoS5qQRxXJGGK0lJptGrycs3ux8UJhf+BA17WaJSD0Gm3qF6HAbdSrBV23FHpvowLyz1pSAVpPYzw9tOf0Yu6p7umHz/Bo9FKfZf6LsEzGyBk9YemqqNP8ppW5Pp4twOiFEZA6BE4GebhZwWgjoSanuJI6g7EtWeOSI6wGu+2x0Car/Yi1FqG5dfzOCKJZdn0Iud0elRaYNpBsqx1+jlZYPncfw+IQszwUb/NntG2qr4yRaZH1EdcPq6MMH5fHmbuIpjUyletjJPD0EnkhMpjQhehFdau63ivADVBVyuizXpNqsK5Krs+ICM7gUULu0Ef3KdXmPvWXILUJ/KWEFjkFy9teiuMCsibicrITKOpfH5zEEha7ORHi/0g7zs/zzmCAcvhjS9EzsOn29NsCkDUUTceLDK5QSH1DfizAiNx1Ca1BHw7oHAMHq5x6xv8hoGTQocNYslRH2q7NxUOzTkHWFS+6uJuOUAvnZLzbROJfR1anZuWPMNTYXiePhrzr8cIgK1qGQaXfRmKAaO+hwtn3K4jKjwD3iyXoorHSU9mtToRAx5otXulUVTMFSivf2aDK9+riYRI+4xnHaP+MPDqJ8w9dr9QVJ2gYBlgaQXdKgqWkfWaKZNaZurk+YnWyzUMX1t+4I2f47LqKq7JhoNACacL/DqwQAQ6uhcljzy/iciKifdFNEbR1auLfBSLUsYe4Inda1evOk0Da67zpdCOwkeHXglXaabzzWP9Oit0sZQ8jFu3fOFU/6s8oWT9iS8/t8qhnt0icNx8JlqiA3bS2LrRx7fmb31U44lgWHEVOBPuKcA3fklXTRC9njsdJQrFXYWO9azPFjHHqs3DsAZLdzeg/PLo/52tyUZhWJweS1IeeDD4g5NmG2EjC7NZwOJ/t6zKQ17EZurEMjcyw4q0aiLAGTbjbjOr5eruhx4bK7dp70LK8SHbLwo4d183OoxhZIEGlozWNZiaOWw17QZdvsRoWAo6699jGku45dMrvtbwoOSckVKKo+sivUv5x+3f66IxTvRsmxlFA15obE55t9xmRK61CWN+032MPU0Zhg4KYHeOS5H5tUXQfi3D9CgCHPKnHImrOKYkbbXqeW6f6sS5xhO/cuy5XNvbzr9c7u/ZVivKJsVw2bCjeJm2aTJ4BPROZDn1sveR2FEVNegLwX+yVoCaT5z9H/fcak7qkufync+bRDy9av1B+K018WElbbRVV26qFEn1cPm7XqiF2UnOm+aUtcKa+42fuOmhS+gjCG9n3gnzbhnVZ1nrnUcJsXWFQh/E/o7PhJuQ/+CW1k7j+WZUj1ISu+YxV0dxus7GEHLC0Iohu2ew8pHPv48tZsO9dpVdz94N4HgefMIBw3r7V/NyKzIS14RMnS+SZ7mMaOoyCjc0mJcwg4GQtQVkuOTdobQCi52CNLyowp0HLhO9F0tXqBuF1qQ/325NK/0RFLlCHcOqTGGkC8m8fSBBU7S0tb1C2u0i7NUJd/E+6TEgA8yZnFT3ki92+I5tu6WZGGtsqcU7NcsDU0uIJFuJjJbltODgNzz0BPqyuAEfuzzOukVXHd4DShOzQzxmDrcij7o7ndUJmhfwDGzwQBGcI+73JpJqsqNTneB7uoM4lo20hD2Li2vHpGLYoeSCLFr+YSQ+xFnsO+u0hPMR9TKFdQR50pw6hhuZW/NmXf3sEjZaj6szeCd6rb3gVi711MJjSOMR9zNBIW2ncXatZGf9qG7Atft+NS5XrSyI4zQlGNwhgraWAQYyCtXGiSNRcAr4QIghshIwQhgoB5pejgmhIVMC7tVkfnBCUEAkHBA2I4oDbexy3eMNogert/FLIxr71X3ObGHyAX+rR+g4lhUApCaAm3iMecjL9yEYzS87Loiu9LcCqFd7gxcpIJ/hokS3euJN5PPo4VsjrkbS3S+9zuei6Piqez44uoCnlOOet5kjNunZELEdN5iGi92Xd0wEj7qeQgYjHiqahNQJS2IFWr7R5yDUCGot5RNeDDGtxqathwq8m8OH5ahRE9ZmiuqglEXebD1dNuiE+tHCmj8zBYy/no7es1cjEPrfixshtfUfo1taZWGITYXdhrXsi3JAh1CaZBaFG40ZhaXBO6wm8ccSuCsZSrhrCaIvUxtgVIFC4LqQX6R9s5QdA/hHFF65ho9Nir8PBqAh8OgRtk4s4msCPQAmKFgWej8c1gZMViOvtZOlgBSQP41Q8e1wl1PW6T5JpJTdylVMeNNMBQG4lFprO37roh7lBy9+W941YRAj2gaLWjC/ARaeUUcNngzqHL8FkmnYzYso27VbwNMS+2czcriXiyrbtdameUxqNQb2kdgPChd0zuF+BDCMrXW0Dla7XlZ4ucRZiFiVC+rtHGE0LLLehAepcYneG7a9y7pIzHo2GX92PtElvLBMQ2dLzg3oIut8Jh3WpkI7vnJ6JUzQY2b/+9ew3RHiOGLs7ofmpsocprPJqUN5cPlK+x+zAWFPj9ymXzsOhYqehz5QF+8i5sfx3fq0Sf3Qg30TClG6aXXbHu+bquKfDsM5soxXNKtK7OK1y8ho6oWFxvz5YGxHTLblAS4cxuUagbkBEQIWImGuIekAn5Fd0XSRvIECEmWE8I5mGqmssE8H7Uu+8lWfVrl0Y/9SAxpYAYV4V1yprklZEOIcosKl5jvfcRecm2QiFhjqyi+xGTJXFXp5JbPiRolvUDSGdtaih3ghEBrfgJifl8FQ6l6UfRmEmeGyWw06Fc21p9UvVhq8U+HMBL2uU7R2sHemmdMfQAw1/grYw0PZam/NIDIiMZlKRJb8tOCu2RkZxXH3uu4dOGUg2uE+e9kV/TuAkR9xUkqPjTx1osUQPAs+p+h1KtB+DnQneAr7pbNXIq4/IYqdHHumFWzV6f0BAPipyUqxrD0bjmDgGd/mjGNMO94ewlSBmXJsn8RYhh6Jrr0euJo/muhKyC1o6z7RCrRXkeFzexqrs4Dc2AJrr9YrSwPSUM5tZpYocBwrjPT3GSloead7wgA5nGoUJWsRMz8eBVcqMXd4ajxHUDJ1MHfBmUcRZ6x6H23VV71Zh5gADquQXse+PKrEl1RqXXTC6MdHdr01kId9TRZkVNX544My6yW4ykpXTEYbjzB2lqLp0xUWHJiPtAaRPyCgAsPkI1EBN2KU3q6IqthHJc1u/Czb4h5tQTemel02GaA8+qP6cbtk8caGf90d+qMmUhy9b+lqENm+GtPhfuGsuzceckZM8Ry42gnSqhEXHfIrpeKOK2ebRbo+rCu0FRbJMQKFhRykSARInLgIj98kZnoKzFXzXOBFhGPk11wO0QdaDfVnvrB7x1zKlBzgV3YSD50PY+GpzWQRZgsC3JKs/LoVyYVis6NZJBqKJKIcKUmu0nQWhJYhCw+KJAS9rM/RLYBefFPDzcGbks+cOHMY2dtQ9ZlqW5csdfvPDyHMkDSrabLVrR18q7Gh6ECBXsNpH+hlvgZCS59PYzzHBtjyHO84RbaLd30zGKWLhaze3oKhTuqe/e0ejLtZsjRoBRDAKIEPMDLsYIEIpEAFAT4nPWZJzUHuZR2a+IJB4KsQdiA219G+FBFszqzZb89UgScW8cvy1TyU8RwjH+5nx9k9NhUDnz1Oe8uzQjXh/YlLpnL4dh1F9VDMd4LtZ/kAS4W4uo84jkV1xIXiyv7kwCWGur88qzMOXVTNroy1WNRmfqO9xHMGqpjy2f9qddwtk3b463jHv5Q0cRBOgKS0KKhoEvN9vQifF5s6Au78eed/cKsYzTzQ/j90xbhYtjVuzO94SoWyqx4ryG4PGDoYdQMGwpMnMzkpqE0K5hOF1PXikYCsrZAUpyIyIqzdxknMdd7Tm8nYSiReyQ5mh5lgfmLpdN06ZqnwbMUgZYmqz7YLcWVnbOWLVxyiLhQmb0f4vr6oxCe7zfu8wraaNSX/elGXlGNhL+HikVKJyCnl6I/P2K3BM+srM1P0iujXDiLg7finhf2pP4c4v+RvwJMdLsHz1k5P2kp9caiFQDhI42Ow+GmsNi3Nj5zuiIK1T/rSg2WHVQeQnXBYQhWqowTIM4kYq4QMy0YWldvYM+MLQsbjN3DF0H9nOq94HqtOegiTShBuzOL5SyM8cmPEUeddc+NtaMpBBIkxbjRryexYEk3z8RocveAP02HJ2368XMFatYOsTVceDt2gED7aL8gsUeyY0+g6mT+31sjlOFqHIE0aqKittB0g3xX2HMDVs1/ljbjw9qaTIqYMFofnAKuQMRoSE7nb2Wdujsw5b0r1esEwbHGrSqrjrNT1q9gBUNPAFPC8EHQWWW/TMEA4fqHds+raN/HqKgs+Ee5wgazxhE4zZKxFDu8dzrdPBXuDt8lGdBpcosl/TAF7Wy64q+DbQKrbC8+oit/O5X29V/UPgPgu0HYRt/tm3l/LPbODy0vfjGZgoEsl8ZbROyt39CAKeBBEN4XWVZ2NshuTCZoCojW1DenuyYSj9JsTO80KblscYYEAnBo2iGfWWyMazVdlXbYPlGZFtGlG3eBbNp9rJr87Zz4Vrb9zFne21xRLYSBRa6QiQ/X8rf2GuvG6YHQYN8ygutcnJl3GMCIxIHLJ8eZ9hiiJWKWuHaEXhVNef8nljS2qjjytOsfLSGayHsa35TZto6sZazQXEIyB62tmyaJuIzr+g2Hiz32zS9klyXsAvWX8QY1P9/0mvTEaa2loNGeltXBvtiauPHybHPwye6aFBEiG63LpoYMeKuQUzszSrgPe1uVHNAdrgRy2zKIT4QfAht8FR674UkkZAiZgmxNea1DcFaKmztzw7xn/g/xy56fDMr69sqIgPfJc2ooQiaNesOFxDVrgHo8jOfDSuUpL5H9OM9FobYCJA2QCFiHUgDGUeUoaIc6B7FDF3kdQ/K1yuFsGJQlCNEj+3TK9gyGuz4Uo9h1foIljhuWd/6JUEgeC1WuhZpDDxDUxyX8S1vWjhFvZbIT9XRf0317/IsYQxrm8kRuJWh77WyMZ9PRpt1aWJt4JChO672hCChM7Jsf7iwblmCXmKI2UpT8m4Bfqc5QgtKSXslZlWnYK/SomKcVNybavFzzOQdWcYcUvfhK1/vt8/IFjVgzCvrv5WvM+Uk/z8yV8swgOgMwXlYgJP3WMTu/E82AXZlU5k6FTZ+yY3C3AUAHAiM6gBmkTXQe8gPEDqNjQedad7u5XU84vZ7BTLV9t8cIRuK9eUOEG3J/ceXvYRdf+Z1cjKywnUbInoN/yXNYjimKSY193bz60G5Nm7ItHfQCV5g0Rssv+9qJfiVvmnNiutD1WmMnezC2kjNcZTK+vnkM8PMXv4blrDfFS2KhvOgcCO+L4yEZHk5X7XebpUWcjcGyPvVrVSacQlk1nL9u+WnhFoYruifap3+ViY30tcd5DWH8WVuH+pU9l8dr5o3ORCFR8gD0MPw/kmo0bYEp2EWidatEO3q+Bl7EbPAzyax4wsig9rFLecfgbycI793Z1lmyROg99qU/UmlO+u+X2Rss7OCgerS+c9NChxGKCn9L6mVtMM2kPgg6vtzAHW22PaaAC7I/VnbgS6aNih+D/bqtDQaLxemRTAN78WlVipflcwnoYwtPyiCp1qQYf9kuQHkSACV8Cyms/pF4+flL5DuUpw3GLmGX3MtUa4jynW+39i5cSCK0XFBBRo/L3+Rm8qGP/PgWkmKAJkP5Y9zazEE61PxgN9vqBxmtuOnnCY/dzmP/pQ/QS852xzftLYQBEXnh7f7aFUQ79vimETpH2iVriXF9GdEv5fuzFKZIRt3bCgFtaUZTPBgeUzwakBxRaXpiOHkf4LMvazQxPV+i5GN5fFZebLj3Iw4wNI1bqxmA8Wh9mfPzX80Dlioiqf3XB6W8Td5SINymRvmmcfZ/2nzt4Bx6DGGj6tnSDYOF5vNyeYHZlBn3jOOcSZiZywpHYxDFXcyIE23kd6WuXBpsPV4E2Lo+OpwLptMRMI+r6oIfBMxHZDKvRcr6+8OG8UtuOzF+ZrheyKeKrVt/bq9TmLj5m3y7MnXbr5+DiGgdBBCG7RzTSmu1T3bNDrT2s4IpRyML8LudGZ7eRvpJWzjWDbOery5MdBvBDsPLl86d/bkiUMHd+7Y3FhZnp+r3V+k4aHbdbuZjKtBz5hxI6LyDI2fNN26fgudodqunI7ka8lO3Ag2sKIrMTuEmHgdz+OCVz+2hteHmnhCKfRN29v1KTQ8JvQEacMZDH1xQ4+INPcu/RyzB9y4UVj91uaiqO+3RN/aQEY7EsVL+EoFtIouOpKgTHrvKCWfyXlncD8YSDmrRPZ8u7pX9zwMlMykvR5FbirIECGJdMl8gnfrHHnMkZ5tdfsmlKUJ/ibiVeTnIHYkAUZCJ5AZuf2kfHG62xmznaEUPaO6F7e7EgHHY8vS6uJ8QkIRxqGym4rQ1eVqXAypMlvK3etKE2Jo6JTiZ9x3BtXi0OGmDwPvIPe4BaxzWvaaBnv59IgU5kuR1Xt+Re9tShy907CMxKUe8aNqTr8uYOxB45K9LJNbCr9QwFw6bBnGTkSNe+0MQDujaDLIWe7oKyPSPa/EzdMKhUDhCrdhDE3fHHXzHlvX8Pp6OewRdRiPKpt8q47rMVtQfkMJ6xHPjavLoZqLVyoBb+3FlUYaknUyqJnd4S4ToTpkAZ9dyKPaUDH6enuuRfCM5iG+gWrdy0+nd7azmUTc8dsWff5D9GhE1J/Q6aUdMN1LQZKlGvoS7DHSFWBHzJlgqaMqZ0SKR5Iyef9IQ/SF5uF42KyRvNhX9pC6wjne3wUrsvQjPor8NspbMDuqT2QTT8+NxXLpdYVLdDM2u726DYsewlfCV+ZNUWAvx6OhWUwkXizRsIfFav6JP30AnmSZwppflvLnkT4Ot6MMTasygx1DckvdFSLaY6G9rdGwnqEbwMySioRZtyoPtgQhPkzsn8AOLmdg+lwrzkbIUgd9FfYioEcMkAzjQCeg9+DZ5bzfGekM/b78awVP3y0ROv7KiKZc2I+lphjaZXkWPTFh1GnshiSmz1oyIp15eVy0YYX9xdD25aFsJhJ2/LLEgai76noT+24m7Ojyp8r0s4vdqjMyy6AsI6VhX/SFcsRAGLtGdWeMhk/Fsa1E3GMvjGdT0m7cVLa7uZ12VVmkmcJFJbKY++ilkDjzDJuzT3e8nE7aBvGHXLE0iZs5mY/95Fz4FMcIU7xSTlNS6lrbXk7jt3Ho/OH+cm6GA+LQOWUkjm7m46byk3FRUIhCdJOZqGbsjCGlvjP21q1ykcszLjQKLOXsqM81zTrbcAw9m7cdIZeXtLobuLRkYDxiSiZj1wGFqRgSKkVKjovAVuv5bNSZWpfCFwrPTR7/IvhmF8dH4E8wvq8L05vrMPuRjBa5dRw6unZGyDRKZwLniZ1a09mS0s4wDBXt4WACzDPOqilKv8KfXTg52Je6k6ZTsWgw4PUYOnOxSgjRKyUb56fdamYI87gKuYz6wCPkziAy2mn9zaiTrKFfLJcPkgJRZq7C5ctRcuMvlSh/um7OH3le/zAe8k1+Z19XzjUdVVK1iq6unMiSeU+Fouq90MvUKPDp9Sy56rTFi+bNnTljilLjGz/OXYVhe1st9esVF5GGlFm5UD3HD3NExg5ZjoyMGzDv01hpKsdWX/UbnbHKV3pzRj8SsBJ2T4GwSKeCqIqdLSeU3Tn7tMry7jwMSBp9vt0s5kpkJ9Jx3FSfJIzRT9x3ahI3VOpQpgbmSQasnlq9+EZwGi8mV3Jydlqb7m4VMDLokDdNukgbejHhNa1QGIxcgWuhx667kTAoAM72KH5nk9Hg2kz7Vur6ozfrMNUyT5cUtjJdpc9m+O5dNZiuvNSZ5zNbVMxsW8tV5t6xjkgvFJWoU1lh3GyrVqAosM4Dibt1fQXuC5gyAxSZ5+jz42GROKF753auULEY4UPXweOYHo5yqFk/yPbZssFPoq3hPbzMobCDlB2QDQW3f13qsm36z2ttvo1PAMz3Gd9qwNb2TfrMdF0k04Wb8Lp4n4sB3AcXCmoutTtiS3Fi3AHDiHsMavqMTYJO0q5z9+wz9pEW4A9j2LeXonaymnhsrRUSMr25Bj15gEMFA1eIxTCt3mCQwPFRXHYQ5R5NFQUz/jWwJe+xtfMLCZ/2c/vl9IAovx7vEfh9PQbDJR5POcVgyoFJQC1YMTATtpwlioKf4Hohgey+yL4c95ZWKKwNuoIRQ4saBRsuzF6qI8WCqp3WYArCzBHK+rfC3gt/A0RjRI87KKovkpKpwYosumBJItHcrgaVxy83EBz08/fLufy4mMfH6LyQR+c2avXiGcFhvBBoOVqnAKKgM0BskHtSQlcRciWIYWafxSI95SYEPLU8HMWsjqHnNtUkZDQiADCizBihOldkTFncj2QZDf1VxEnFk8qFpJ7eFUTExnz+ADUe8Z147LjnbCzxNCK2WItMuKQVznh9gHOOYWChgz5yIcFZ5zV9/609yyI+gvwE+r4u1DfXofm4LZCGcoyRLxQVLbIiVeVdKlt9FzZle8AR2aMzQsuonWGYfQN3xtMa7lQCzTdXzsnHFUL1AYXTygeAybt8wqmTbh79Et+EFzWRbEF2GDNcXxGicqR61JMl4EN4Z0Aah9QZFeMJFcIUndb4hOwU9w/QmLfXDiMkkh5Q/XCzmLRlkVavBBcZIBj0KXCf43UluK4oPrLvZhKRgKEI7NkZ4WZmLfSG9JkMNYWtmN9SqfvYllxdmLM6Stz/r3jns3zxaG8rHQ87HplnTu8mba2RBxedRQ7LK6bXLBQXI2fLbB/g1k03b+gL4912uVD1OZEh/2ruqkJxOlE4lH4Kduts1pskGGwbbE3/oWJvixXPwzmJW7KfDDxiBVu9GNjAd3XShibDKrREtab3Swn7FKkj83rWtIHXulG5whnTHgBMwbTvjqeS0QitpOsaa4Cf4lPfllaZIjAXDnejQZ8qQmm6osLlfRe5/akEqhyFFkmV0tjL1zsCbWY/bO6pVc46Udbr8+WeaxrEleXeaZltVUmqwau+7qJmtGke2iUPWRj5ksS0R91EtbMhLRvRc1ESGYU9xDCM5xTG0dytJzKfE5jnAQUrEIE7Xay1tQITU5tXGF/JXAHMsqtG4B5wj715ZSGBg61TZ1Sd8qmoB3SfwevZNRjizW1CriLT339SkbmAF6dPOgAqlvmsO3MOnsCOSDc+eFkzywrJGBre2arPJG1dRGMQVVyL/Xy9bjZLa5+Zb5c8/MPlUi7TMFoy8suCkO1l59mn2uu5D2fPMChxBbm3rRP6bMGHNK7QpNqQzKRDGPZ55aU8Hb0EnMzFYqcfWan1Mkx0QF2aYJeK2bua+YUMiSydgHpop1ad1AVJzYERgu/kXgVP2KuyrFBAdVsBBpc59+DVw6iJA1BU8/8iRI7UHLnGSkA8pOOJVGcn55JYMKZM3WqUX5mfjjyjyYKWP2Nj7R9KrbcwDW2Y2tCWbvDavFMLU9TUg2viDBB0NDap4j0vM9PA5oauEQny7OldTLareXh1e/bdGlT2x3hCbIRP57TKPjmNdutslrwkc2ghcA6iw6UDET00nMc57eaxmkdXDa2nRCQxEx64xxMNVyzC5expGJtMgPTfaNEjSZ6Irwk4kt2ja8wFJc2YLuSUfSImtqEKl+YNqM+h7DB8PoU0Euno0Ewb1FZ7EslwYqxaF6H+UdVrFY8Ez56jo8EP8y45n6HMaLQRc5GAtxeDNtOIgO31FMaRVpwtyAV6BnPi0ipkDnrjOHO4BtPRY0EdTTsjBhmHbpJGFsHhlN5FM8jNzSgFZ/ttm1N7W5v53JpDxyeveRgbkSOJPYqbNPxciavnRqgPdU4ptAkib34Wwj3e5VrgJn+mopWKrzvzULqLr0Mkq7xRMwzDzrBN3bPfE3djlP+Qd1MQrGJf4fFhY68QH8If4JDQa1oBpJuiKXoy6XgMEwLf8BVCKJjFEJh4tCUjNOHeZEl1UMrJG4HSOIFroLxapaIN+5tRSPf/Qj0l06LYvasiUo3uKwh9HBUbOpgIUAk4C4xKYBfd71ZLBYxz3R6owKngWCBmqZDNJ3DN5ma+opS3Q4evBJwu/DZcx1/uxFCZFCO44DllTys5E2mG3RTIU/T54QBZviLM5/TWx39I/Y8KmcQkUN3LuVgoz1PkCwaqXaCC+sCc00zjY69v8YGpevJEbDybhHZXK+4cQNoQTEKPjUgvlhWf87TCeMK4wtnG0GW4ePWYga2AUivLPXD9/pzArlPWshN+fN8RWBK/udYnPklRwJN1ofT7NgdjAFQlW+69VGV+ZFD4PZ4ane/XOni5ZR2MR0N8wEIRXEinOtSTdM9n066VRTrODeKkNR1ORGLBBlTSxSMBhwsdjOqU3lihQemETOvNk8vZiCcf0wFfHkFLGHhcqknyTJ78ywWZbcP9eqU/SJhaper5uCzSGbNTmffWYlY5DQEl3GXoUL+BA2Xjgjg0UIfF+3yeD+lhf8Hl091ACVeCixCh/okWyUWTX9DU5z9Y/R+JICWg52FETR4B0flCocR1BQg/SYKiYw5RYjJuhm0l3v6C0XYZhToSl2Gkuo02Jix8Vo2OOATrxGBQj8ViqJKWsvXs8PlE9QHCuAxWEF+u4fw60suQ5zNgakJdnIqnXGQVKy2TBKlJSCfSdDPXT1HKQAK4FLDP4LW4l7RCoaRyhSY3Sque7FiaEhpEh74dy8thM1AiCbTl1Mz7xjs5eDbMcEP7BVl66XtiMxXTZR6fn9pap9WvAC4VAI+mlORsVSJyMHYSQLozsugt8NTEz07zuUZI5mLy4rIQ0bS1jwOlXpmwJy6VwE/H+gRFHgAhBwvYThYw5LJmbblaMjbIASI20hnEApqlAdG4ix7msAuNVAyyF+EyyAu/tvZMmP9Tu+VmNuSw8Kpxxcd2Njk5xEM0oZfQ1nwZEcoUxTdmR6JXLEJh7DL0F84ud+7+BMLEAVmZRwXeNJXrlfxcU1elkg3BctgDaqcWpR3fO5YjbqRbli2qmKlID2lBvCto5XRXtM5mCYo62U0VD1I4Xbh0Hbrj0JY2/AwbD87hJnJDeMqcUOLGEmxt9OApugr0eINnnovXL2sSHG2+pHieYgXm5x2my9UVw8T9id2djfUu8UWF9R/Cbjg6DMrppxO9AnL0TYAy4d5uiBUGAistkO9ywdRdVDcgc9k8BBBYbzxTRwEHnL+SgwqXJqT3wb9cxXgV8SJEqccJyqCY5mrxMfmJETBHdFcCI7FTq50dqRSeCNFFNIl8LOQ6PFloZK7QpCvoZJYXIilS2Z5RfnmDZA33yNLWFGeUuzqOdwCz3BHj8SgzuBpY24UAnAiJ4KrkkSnpVKdUawdE5umE51ihMGhcgbdDfZnqLuTmxhQzd0YSTTtI8osrWJeA4HIQa78txIKl0V+JJXRrrbWq5m5We6Ki3ILSNZJJF3ZUhzOeoke5x13SAAqY6H+twM3qCkYM3Q5YNBQMPTDnQK5XySwkSRveL0CBTRH2Y8tCaEbXkfMwoolooD28THkPUZWMNhugBMuZYgktWcNASOZ5SRQjKR5184IgYfykw/XkDZbicnG5x9pn4D8d4vSNj6bxDA3DCUeipxMxT8ToHsc1NkDSSEtcSTeBPHu4ICERDXiOBgwEBZTQC9uNjpeg9rllCmLVd4ESwlgnXtMTeaClgDXzIw5p2+hLBVGb24N4PklORjzGnG/z1vmmXDoTsE8DcjSYiJ3KcJkCbKFrTuE1p/cBtcYRRYBXk4f38mmRmgz5OT/R1BDnW6kStH45juyeT2It1OwcnDWuCGpOt0A3OHpkisGXaFWkIq3kuI6g7C085qVxfcr2E7g63MyrEYqzbI8OwZSLMh+G5zjUUYXn3GFFB5AATpKeHnrtO0oFBQIeSXCfVF7Yj3gNDys4yEtnJFI4Fk1gVQ4NVAkqZtSW4xLAhTZOqkG8ZSX0UTJVdo/aKxMXTiGlcKA2/GyiRluhUOJcAeKbbyCBmGgAlq/xY0kaHNPYC+OpwHECLxaZNpFsrtmIefNjEiN1PJl0nvQnzEgxp3sH4J5TFHp3AtMkhQJGsojHWEVbLu0iI6cVxmPaiAeAVpkCHRal6adDlcCjHZQmF/1cMlcjbTOeLoJfFYWbJoHswPuF/ItKY6ti+4YrrjPvJ1xTadfufZ5g9/KZbT7IBYFx7BxcZf4dOeutEaQZj73bSB+s4CLCubqGQ+Wq8B7gNWJYIkR8bPRHNgYbGkBvNKxWJplF42L54iCBhmIYVm7PcJbO++A8EV49O+NyvNr6tTotZ6kpgpSIC2E5x0Vf4uB+NpoDbjK+fc33yrTCpbfIK4Ct3znplnMSB/1szNHNcbu0fMkQsXn8pAt0B8gQqBCgoxyDfL2WZ9OJLESq2o0YqFRIw9N8upz9mBtfRPYV8Nxnlt/jsmGljeBs71vMQUZVJkZdG3lB+8RCArvXZU2rzuk81vygEHmvLfpCDmZHCoVFVsjxgYxWoM2kqTc215nhrJWvNJ9Rzyw2YpCO0M5tsjIDVUqQesRNzXVFwCzsZMDOuCfmok9Mvj76sF6rBRB+20VAfiKyK6PcMc4zScHvK8tQLhoVIhSdAEtwvwN5Qnun823nlosglwkZjw5zmt3MegzcY0j83qvjbN/qYhXKIhykUyJAa0pdDrS0gBK7M/b+bashcALrUhwNlnE69Lh0X309KpE4hUst9IMYsc0UQhXkO1LzpoSHzr3HTTl2xbckDoWP61LkouozVLR6EhpgNnQLo409+qeXgkdzdqYjhE65V23IX23SES1qeBHi9NtidzgrXN/rS5JjsTXBHN8Uk/BEMoqn0mO4h5HZjIRoGptaP5V8IGHsQnCZx1o/2MbpNMA5YJNcIstq1tdzRPLoLkw8YuB+QkxpE9GDCcOIrmcKl01XSMbQ9G4cDgMHkNZuCYnkn/VoI/TVWMbGQY8eNHIGOzMsz9ZtOZhK3mTBQ4oxSlEj1pAbT8mS89kRDBu0/2fZNbMGwyO0274lUz2S4Ja8M6DF0LoQmVKDT3m2Pl9AaM/UKBhQRkcXZykb5p6vEhun1ZUQnNowf9ZSWVZCzeNCgUbRToZ5tk5rH2KIRBPz3GPfvskyTlZXKKCGrQB9bzvzNMWm2rQltscRfWfPNqi1lnDal7NqGNiGrqFRRkqnVvUYYxxnHdu2oOsaa0C3dpc0mLD2I6n4/DFQjzYtFOjAIqe8TQavf5zOZeYS8fHV9+FAw8yGbRGiKdoL09Z3MQoDuTRAlFQIPVDwLPJ22z7BbViYludDZUeQRg7NK1kiywMJ5sm63RQCEt7BT+LJ0GkfDh7ltZEpSNWk2GbPkahj0GK6lYDCZ95h9ARw8dtlK+XD9LJCoSLqKeBlPrycCslVBjqSp3cAYhRW9eAIcbTlgiF7tklHazD4cXxAn/TfGIO6rb68Dr4nkPkDjkyRMRlGew5oUFei1nTuKtBTAnIFbpg9hRl5mvN9jiuICacwcwd7aZejJW/3eR1IZun0DQ03pCX7bqTjUhPcxCscEoi6wuoYFntU/8W39YWlqaLA3Li8ODkOa7OVdVJEIwfeofqk4+v94GrFFZcB+T+k+L+3oNM5k+bRWAvHSw4CY9e9TcSHeiMHDbjOiTKhnKiYcp16/lqmiIxTGvkxJigUAuo1oPaPuk5yWfw6z39JYpPnbyN96B0SdSwrHHIIW6F4DHhv+9+369LUaZK2zKIIsAvh3E591ThUjcyA8r80//M+KMj55m2gRwL6iNZCQBTvcp3JD4KOy10rlInVS+2+1DydaBvRTi7HRvrmizzY8xuC6SOpPQ0Bd8xesAK7rFDvvmnC6l9CXEUX8zbSRyr5b5QHSMawRtjBcjmeq2vUtfMzL0327qPWCBbCVNbYFsTWkSZHdIXrLL2u1IGNtXUMND4zudNWIeuWahBhn3ctE4W2bI7bZOY8hwPolMaGuU30Sk2uJddpSGNLsx+h86idCbKJpLMlJOgd3M3PGGaet5555lm3RzaQVQ1ljr9ssAKEbxz5iDEpC2keL/Qob5tDQDph0F1jEp7mtSD2v+eqznipBaLyx6+hEJ3odDJvlRT3d9Zxt2ugFlPoSo26PIooT/LmpJ943B++ot87dVlBj983i2rOfqs0J4V6atbWagiQpljyKWxgFJm48bbjzqxgUjOYEEeeqslqPdUL0g772bR1HhedGcA0rihFD7tXSQU7KqKnriZVnoIdbbQaorrnYz4tDH6bKwj+g1MkpkE8hXd/EGoyETCh23LeObdgz+5QED3l6Vix7DkAYMHcieC42zsK7uWePs4jjvCs6RqoARophiYmIU1F43vNiIjLakV7tZ/qK+jbLg3EEYRQptmxugqNR+CSAUMbZZT37SjJS6dCqz4jpbgDOMI8BCGBWJpyS95CqUQet92rqYp1GSuK0BWcJRWgy8Bok54zg5p7rgT6iDv5iPwY+fJDJMmSpAE60Q0ycuZbCijJ76u657TbCvEYKhZSZQMpL55XAbXcxGBt9Si1zpYQpL3DzdBx1prUxlRngNfBawtyybpIygllaHJPkxJ3lXubQZHxDeYVxt9rrABHnnDvQD8GClNk1OYBrgxzpkjDXTxBRGZ/oIOJJKLIOrmcdjzs6bSnHOc6YWqh3uRiBfMDH+Js2Mqz2jvmJ8+461jmB3lD8CX95Be2pMuLQ57yqxuhG00WUi45lSSfbQOew/sGm4EKUXmHnIuMLNqF+UwAQWRT+uP3l9FwKXsGlZoqSGFedKzPpFJAOama0k5jlu/4bphQy8GLXb29VlpmLXT4CM2OeR60kG37EaxQ8PsI7lGYdjdQpeGWuPQifV3K1XbC4P4gXCDs9Hpqq8/YJgRXRUWpMxTO/zs0rKkJV+ESXbsfeKc2fZyYFC5tKG9CCkfZnXINFa0peIh7VCRiyTNnKN3A5RCAJomBLLgku98aFOdk7K6Rt7Dmf7FCDHQJ70lIY1JJPfCoG2EOlqFu+0RtZ9uf7bSTc44CVpvZ3Q3IszWbkSqgVPJJymONqlEL1n+S0I3QAQFXggHWsF02VvuCFm5kkNkFweBt8E6QEnGfMLBOTAEi6/PeqJjMaByfxVxy85wmk1a1j4rV8y+ZXmFqq2pt0a+d/YqgRLvgJg2AdAZd5YqQ3R2pGGoOY8QBkFfsvTr3RxiF6+nqAtkt6rWoIPVisEyooWtv2KrcsVb6h5cCyhXgfYCTW00VnnTqVsPhG8hUmHaDkHJq9jbCp5Gu7lr2dzl1byO3owKzWAA7uTtoJjNeEChFO8CBhtCIiH7nkpS2gozfhROwijMOqujVUDuNk+Dkow2RUjpl9fsWNHTQIq3bYD+sssejSISybI1z/VUVj3IkPP4emfIPpo2Y8Iy2sfNyO4OSMmywn+rg3QIO0fdlsCkNlkaIEqwX7HiN4QZX7nD1RQIlEzsXPa8DO0XlTvRUArW2s9+V1g4mbQspZz3LslC3U72EiZTOVu/hQUn70Hs6vSanf7lTLyzJUSWyTswVL5fpJBTkjZt7OodN0Y9t4nW2ClvPIEIR9CTmuZ5dRvgWOXDn2Te+3fGdD4oiwze8PD2piTWwzj3C1Vp74b3ltr6oUmnKmbqV2pPYMrU/3+kmhSw+3QXRTYLzBxtWm9Zu0iXk7yR5lqMhIR9e2AowpHP+lpgHQuYDbFQCDpDCkXv6WCQDlgmN6eN8/bftkwUFn61d80mE63ajJvoTkwX/qpMUIM6JXUQygIHyGn5LRMIY/r7nzshpBTBvwh/t7tlsWKZtORiCml+2nyyY0k5WIaZ3G1+H8am9pwr3j/a4+mIqP1zZ3ZFRlsbFVWdGq9EDuJLJ2ZMpJCMSnsU86TrK/GnUn7V2H892JWY4P+bQmMj2oAH7fe8WWJIFhSSVTvqoZS0G4ZCkmxW2+Sgn8OwRNU+gLIqYZ1pHDXlouTMC+pi0QlJ3ghiRrbiMiyOsm22dBo+k/u1mP99EAaFfPCQZwHFpm0yVB9e6xjOOWi/7TRUlMw2ugO8rwVQWsxTDa4MMyNtiSRtqymCH5+O9J/RkqhIYxHMG7Nbv4czvBX0iN3k2qJILIl+0JAwBL0IxQmD/uZsiHWlI/XUS8t1Itz3cXTJWuPRBWWFMDC3ipkxqVKUUhBjVIYieAvB1Agn/ILfjYVezlIudP0rLlfxyLtifUnLLX8KYfOwFSC8AltDL1gbMDm3ABOtLW1DrFkaZxF9XIkOAUb4BRoKeC7jelwp+2nVlGeFl6mvCAH/R5dOkLXrHu/tuaJOP5jw+ZJJ54234xnyLRYTuhiuxaSE/7LJ1y0dG2DBa99ui2LBuvmTrEb6lexwlvHRS2tyGdjwiqSRGv6W9c/usRuDltXXn/lLCutizFe+jBc1/bjLuIKGUXtH2LtCSjGl6m1g3fl0tJkMqJ4zZTskwBpHoPHvqU7tW/nMqjLs+XQDwIxisNXqn21Ho217uIWVMK6yOYe53qp8RVmzqDzb4OWBYQR2HK6m+KI49tRrwzOP3j2USk4dN5dNkmWItje/3ROo/7shY+llLm5kdscRkXBXk32EJkQs6Ab8D9wH0U7dvplqmqhC1meuuKAzuiNzz9HNcB088PozrL86RMG3U1NkEtG3C75PYko5bXzyP4saY5zCISejVBapZsNUDusYjIoSiQtqfH+LXNXPg4Mc9BnPa1vE26y+PBnTv8qsvV/lWOdswWEu5UqM1+QWQCsUwXcmpc0Xb+Cr9m3njiMas3RaFcmNL56al8B03hfqZXaHe/L///3s9r5e+q0oClpHVbA9ZWJGz8cGRyinp1uSvjXMVNiLN0ZnLP436yXJ2/5+eJbac6f+PLzJrzlY0rmZX8F2JG5r2RdrzsadtvK+neoWGSh7VPOqS9jzqkHpotn/z4cPtW9eunrrsfwLPnzt+7NDBY++7LHWdBpdXU2YqPqc2HHk57dmHh7Z7ZbLCP2/zCjC4mvfIczoZJyJkEgo9b3VsupUfL5Q01fCjDFVfj9vltHZ6/Ru/zGT8e+DiuNi3BX/mVZFtwtxTB7/4Z2flz1xi0J4ug70PGUNT89g1jol0dNpLTsIZ5SWW0IN8uA7ayZFVtG3CdyPd7CUjDfrus4uhgQb1x4ra+L1jnb6f48Hd3Eqfh/98gt3jSLJEjlQeHbCEUyorVmlaizRhhn2zXlPM6tlX684K8Fp3b26kkou6o6VL63dU5rNdjiuLIQFIp2+5/+vCdgvwWyKLc+FgXGl+T7yXBBOrd6iMICfFSDA/9DYqICscCmCNRWDIJtU1BUoNhGUAZ0AmnO1iicd0E7SZQC2mukBAp6OMeP5ZOabehwYvS+tA4qQDpLOBAY6asfsV7szWg8X/aNUfkK0q0zywC8XS2nWzjk7GfxaortwN1RAM3rMHV8PuRgQY/L2+/malBzM+0v0G8OxlxwYCPG/x/6Ne5WttLB+QxAAQ/ErIIR3doN9nA9kv/RbTASXnz27nlcjmqb8e/KUwWr3e/cWZ3VfCzYyWfcyecczBbTuHoFXkoOMvBX+iPb5w4Hr+oBd/4hGP9PePcBUxtbPHP1elzWWMacuBR1ZfBZfnOY4z/2QzeOQulDDizK/whokN555k+MdpeLQClr2Pnf3IXWRsgnBEDyBk9+Xf/TM8eKmYgTD8l4Hl5iqVrb9spZwR8M8Tkos0MJmqTAO+VGXBEeC14qgwBdjn6vHJRMvpJzN69j6Z8zf2yQIr7Vgsz8VSeXCLnp0ANunvl6lF8puonyZ9dVDrr9W++k3XzZeirzZ+8qRaPnGxIIGC+CjUcrr8AN0a9O1o0VejmKKXLJAv/4M5XYFsVn+nRimRpUyuKPNWyYzJTKJQG2K71uYSUNf3FyCAN7l5j1qsVrTka6aiU4smbN8EA/TXTnGgr8ydWov+DnX4aifs2y2eokPX06S+mih6eGD2oXBILxYIfMb/gRIM5+yKSxrt0GSn2Vy4aubmC3ctLrvqGg+evHi77oabbvHxC2kvVKtAt93R5p45dtktyA/BQoQKE+6+B9o9FCFSlGjfxEjWcdvSKdP3WC1FKkWar9Kp3ZxPHxkyZcn2SH8DDYpIBsiJKHJ/we2WweG+hxhmuKHWGGGPIj9/Yezbcooy5UYabYxRKlSqUu27o2oimtPOWGElYyZMf91u9qtq/28TMUrKc9x/ZPhPjjjnTGJL3zaCdSSGHK0l0mLHSGLEU6terHjadOyzl0EksMVWJ51ywX4HHHTI+UhkvBNUkc0EC+n55Td3yBzYm6fBehqcaJpsommmmm6cOp8lRLJylad8pStDmSJUS1kyiFS2cpjhpcdmSvLUC08K26zPzVnVzScPD5xcW5k1Bp8+1tp+uWfuPYePXa0v8ZfyhfBi+g8w4D/wdzeg5x02ml3ran0hgpxT/zhQkDy2vf10Y/DwjuPDye+D/4RB7qF/y0DKch24dPHOW+w/s7fyonzQsZMH0/7XpMeZMyf27T+jlXClMxf/5gOmh8Xn+5nbXwpk/dDlAf9X6MyKrfhNe4ut/Uqq/O91B2Geb5v/eRympyP83aPn7heJiTTz/3v7YvtgNEOk/Rg67fT16yS/7vVrFlT+omveXqF15GCj/5x9UOHW+KzD1umWce79z75fy0dkN9whHCZ2+rYdpb+rdXpYcgcAAAA=";

// src/svg-renderer.ts
function escapeXml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function wrapText(text, maxCharsPerLine = 34, maxLines = 3) {
  if (!text) return [];
  const words = text.trim().split(/\s+/);
  const lines = [];
  let currentLine = "";
  for (const word of words) {
    if (lines.length >= maxLines) break;
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      if (lines.length < maxLines) {
        if (word.length > maxCharsPerLine) {
          currentLine = word.slice(0, maxCharsPerLine - 3) + "...";
        } else {
          currentLine = word;
        }
      } else {
        currentLine = "";
        break;
      }
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  if (lines.length === maxLines && words.length > 0) {
    const totalChars = lines.join(" ").length;
    if (text.length > totalChars + 3) {
      let last = lines[maxLines - 1];
      if (last.length > maxCharsPerLine - 3) {
        last = last.slice(0, maxCharsPerLine - 3);
      }
      lines[maxLines - 1] = `${last.replace(/\.*$/, "")}...`;
    }
  }
  return lines;
}
function generateSegmentedBar(percentage, totalSegments = 18) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const filled = Math.round(clamped / 100 * totalSegments);
  return {
    filled,
    empty: Math.max(0, totalSegments - filled)
  };
}
function renderRetroTvSvg(stats, config) {
  const { screen, tv, tvStyle, showAntennas, channelDuration, channel, username, badgeLabel, knobType = "line" } = config;
  const isAnimated = channel === "all";
  const totalDuration = channelDuration * 4;
  const badgeText = badgeLabel && badgeLabel.trim().length > 0 ? badgeLabel.trim() : `@${username.toUpperCase()}`;
  const cabinetRx = tvStyle === "trinitron" ? 12 : 30;
  const viewBoxY = showAntennas ? -85 : 0;
  const viewBoxHeight = showAntennas ? 585 : 500;
  const viewBoxWidth = 800;
  const screenX = 46;
  const screenY = 44;
  const screenW = 526;
  const screenH = 412;
  const h1Pct = 4 + Math.random() * 4;
  const vsyncH1 = Math.round(screenH * h1Pct / 100);
  const vsyncDur1 = (7 + Math.random() * 3).toFixed(2);
  const vsyncDelay1 = (Math.random() * -3).toFixed(2);
  const h2Pct = 10 + Math.random() * 5;
  const vsyncH2 = Math.round(screenH * h2Pct / 100);
  const vsyncDur2 = (12 + Math.random() * 6).toFixed(2);
  const vsyncDelay2 = (-5 - Math.random() * 5).toFixed(2);
  const knobCenterX = 684;
  const chKnobCenterY = 118;
  const volKnobCenterY = 224;
  const channelAngles = {
    "1": -45,
    "2": -15,
    "3": 15,
    "4": 45
  };
  const staticKnobAngle = channel !== "all" ? channelAngles[channel] ?? -45 : -45;
  const weeksToDisplay = stats.activityWeeks.slice(-26);
  let totalIn26Weeks = 0;
  weeksToDisplay.forEach((w) => {
    w.contributionDays.forEach((d) => {
      totalIn26Weeks += d.contributionCount;
    });
  });
  const getLevelStyle = (level) => {
    switch (level) {
      case "FOURTH_QUARTILE":
        return { fill: screen.bright, opacity: "1.0", filter: "url(#glow)" };
      case "THIRD_QUARTILE":
        return { fill: screen.primary, opacity: "0.90", filter: "none" };
      case "SECOND_QUARTILE":
        return { fill: screen.primary, opacity: "0.65", filter: "none" };
      case "FIRST_QUARTILE":
        return { fill: screen.primary, opacity: "0.40", filter: "none" };
      case "NONE":
      default:
        return { fill: screen.dim, opacity: "0.25", filter: "none" };
    }
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}" width="100%" height="100%">
  <defs>
    <style>
      @font-face {
        font-family: 'VT323';
        font-style: normal;
        font-weight: 400;
        src: url('data:font/woff2;base64,${VT323_FONT_BASE64}') format('woff2');
      }

      * {
        box-sizing: border-box;
      }

      .crt-text {
        font-family: 'VT323', monospace;
        letter-spacing: 0.5px;
        text-rendering: geometricPrecision;
      }

      .glow {
        filter: url(#glow);
      }

      .dim-glow {
        filter: url(#subtle-glow);
      }

      @keyframes led-pulse {
        0%, 100% { opacity: 0.95; }
        50% { opacity: 0.35; }
      }
      .power-led {
        animation: led-pulse 3s ease-in-out infinite;
      }

      /* Dual CRT V-Sync Tracking Bars Roll */
      @keyframes vsync-roll-1 {
        0% { transform: translateY(0); }
        100% { transform: translateY(${screenH + vsyncH1 * 2}px); }
      }

      @keyframes vsync-roll-2 {
        0% { transform: translateY(0); }
        100% { transform: translateY(${screenH + vsyncH2 * 2}px); }
      }

      .vsync-bar-1 {
        animation: vsync-roll-1 ${vsyncDur1}s linear ${vsyncDelay1}s infinite;
      }

      .vsync-bar-2 {
        animation: vsync-roll-2 ${vsyncDur2}s linear ${vsyncDelay2}s infinite;
      }

      ${isAnimated ? `
      @keyframes cycle-ch1 {
        0% { opacity: 1; visibility: visible; }
        24.4% { opacity: 1; }
        25% { opacity: 0; visibility: hidden; }
        99.4% { opacity: 0; }
        100% { opacity: 1; visibility: visible; }
      }

      @keyframes cycle-ch2 {
        0%, 24.4% { opacity: 0; visibility: hidden; }
        25% { opacity: 1; visibility: visible; }
        49.4% { opacity: 1; }
        50% { opacity: 0; visibility: hidden; }
        100% { opacity: 0; visibility: hidden; }
      }

      @keyframes cycle-ch3 {
        0%, 49.4% { opacity: 0; visibility: hidden; }
        50% { opacity: 1; visibility: visible; }
        74.4% { opacity: 1; }
        75% { opacity: 0; visibility: hidden; }
        100% { opacity: 0; visibility: hidden; }
      }

      @keyframes cycle-ch4 {
        0%, 74.4% { opacity: 0; visibility: hidden; }
        75% { opacity: 1; visibility: visible; }
        99.4% { opacity: 1; }
        100% { opacity: 0; visibility: hidden; }
      }

      .ch-1 { animation: cycle-ch1 ${totalDuration}s infinite; }
      .ch-2 { animation: cycle-ch2 ${totalDuration}s infinite; }
      .ch-3 { animation: cycle-ch3 ${totalDuration}s infinite; }
      .ch-4 { animation: cycle-ch4 ${totalDuration}s infinite; }

      @keyframes channel-glitch {
        0%, 24.5%, 25.5%, 49.5%, 50.5%, 74.5%, 75.5%, 99.5%, 100% {
          opacity: 0;
          transform: scaleY(1);
        }
        24.7%, 49.7%, 74.7%, 99.7% {
          opacity: 0.7;
          transform: scaleY(0.97);
        }
        24.9%, 49.9%, 74.9%, 99.9% {
          opacity: 0.85;
          transform: scaleY(0.94);
        }
      }

      .static-flash {
        animation: channel-glitch ${totalDuration}s infinite;
        transform-origin: center;
      }

      @keyframes rotate-knob {
        0%, 23.5% { transform: rotate(-45deg); }
        25%, 48.5% { transform: rotate(-15deg); }
        50%, 73.5% { transform: rotate(15deg); }
        75%, 98.5% { transform: rotate(45deg); }
        100% { transform: rotate(-45deg); }
      }

      .knob-marker-ch {
        transform-box: fill-box;
        transform-origin: center;
        animation: rotate-knob ${totalDuration}s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }
      ` : `
      .ch-1 { display: ${channel === "1" ? "block" : "none"}; }
      .ch-2 { display: ${channel === "2" ? "block" : "none"}; }
      .ch-3 { display: ${channel === "3" ? "block" : "none"}; }
      .ch-4 { display: ${channel === "4" ? "block" : "none"}; }
      .static-flash { display: none; }
      .knob-marker-ch {
        transform-box: fill-box;
        transform-origin: center;
        transform: rotate(${staticKnobAngle}deg);
      }
      `}
    </style>

    <!-- Phosphor Glow Filter -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2.0" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <filter id="subtle-glow" x="-15%" y="-15%" width="130%" height="130%">
      <feGaussianBlur stdDeviation="0.9" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Subtle Static Noise Filter (Light analog CRT grain) -->
    <filter id="crt-static" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" result="noise" />
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.055 0" />
    </filter>

    <!-- Scanline Overlay Pattern (Light, non-obtrusive) -->
    <pattern id="scanlines" width="100" height="4" patternUnits="userSpaceOnUse">
      <line x1="0" y1="2" x2="100" y2="2" stroke="#000000" stroke-opacity="0.18" stroke-width="1.4" />
    </pattern>

    <!-- CRT Curved Glass Vignette (Softened edges, bright corners) -->
    <radialGradient id="crt-vignette" cx="50%" cy="50%" r="58%">
      <stop offset="75%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="94%" stop-color="#000000" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.45"/>
    </radialGradient>

    <!-- TV Bezel Shadow Gradient -->
    <linearGradient id="inner-bezel-shadow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.25"/>
      <stop offset="8%" stop-color="#000000" stop-opacity="0.05"/>
      <stop offset="95%" stop-color="#000000" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.30"/>
    </linearGradient>

    <!-- TV Cabinet Outer Boundary Clip -->
    <clipPath id="cabinet-clip">
      <rect x="18" y="18" width="764" height="464" rx="${cabinetRx}" />
    </clipPath>

    <!-- TV Cabinet 3D Bevel Gradient -->
    <linearGradient id="cabinet-bevel" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${tv.bezelLight}" stop-opacity="0.8"/>
      <stop offset="12%" stop-color="${tv.bezelLight}" stop-opacity="0.2"/>
      <stop offset="85%" stop-color="${tv.bezelDark}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${tv.bezelDark}" stop-opacity="0.9"/>
    </linearGradient>

    <!-- Metallic Knob Gradient -->
    <linearGradient id="metallic-dial" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4B5563"/>
      <stop offset="35%" stop-color="#1F2937"/>
      <stop offset="70%" stop-color="#374151"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>

    <!-- Knob Rim Gradient -->
    <radialGradient id="knob-rim">
      <stop offset="75%" stop-color="#1E232A"/>
      <stop offset="95%" stop-color="#0D1015"/>
      <stop offset="100%" stop-color="#374151"/>
    </radialGradient>

    <!-- Static Flash Gradient -->
    <linearGradient id="static-flash-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${screen.bright}" stop-opacity="0.35"/>
      <stop offset="48%" stop-color="${screen.primary}" stop-opacity="0.75"/>
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.9"/>
      <stop offset="52%" stop-color="${screen.primary}" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="${screen.bright}" stop-opacity="0.35"/>
    </linearGradient>
  </defs>

  <!-- RABBIT-EAR ANTENNAS (Optional) -->
  ${showAntennas ? `
  <g id="antennas">
    <ellipse cx="280" cy="18" rx="28" ry="8" fill="${tv.bezelDark}" stroke="${tv.bezelLight}" stroke-width="1.5" />
    <ellipse cx="280" cy="14" rx="20" ry="5" fill="#3A3F47" />
    <circle cx="280" cy="12" r="5" fill="#5A626E" />
    <line x1="274" y1="12" x2="175" y2="-70" stroke="#717D8A" stroke-width="4.5" stroke-linecap="round" />
    <line x1="274" y1="12" x2="175" y2="-70" stroke="#A0AAB5" stroke-width="1.5" stroke-linecap="round" />
    <circle cx="175" cy="-70" r="4.5" fill="#C5CED6" />
    <line x1="286" y1="12" x2="385" y2="-70" stroke="#717D8A" stroke-width="4.5" stroke-linecap="round" />
    <line x1="286" y1="12" x2="385" y2="-70" stroke="#A0AAB5" stroke-width="1.5" stroke-linecap="round" />
    <circle cx="385" cy="-70" r="4.5" fill="#C5CED6" />
  </g>
  ` : ""}

  <!-- RUBBER FEET -->
  <g id="rubber-feet">
    <path d="M 120 482 L 150 482 L 145 496 L 125 496 Z" fill="#0E1114" />
    <path d="M 640 482 L 670 482 L 665 496 L 645 496 Z" fill="#0E1114" />
  </g>

  <!-- TV CHASSIS CABINET -->
  <g id="cabinet">
    <!-- Outer Cabinet Body (Clipped to prevent any bevel corner leak) -->
    <g clip-path="url(#cabinet-clip)">
      <rect x="18" y="18" width="764" height="464" rx="${cabinetRx}" fill="${tv.body}" />
      <!-- Top Bevel Highlight (Clipped) -->
      <rect x="18" y="18" width="764" height="22" fill="${tv.bezelLight}" opacity="0.35" />
      <!-- Bottom Drop Shadow Lip (Clipped) -->
      <rect x="18" y="460" width="764" height="22" fill="${tv.bezelDark}" opacity="0.65" />
      <!-- Subtle Bevel Inset Stroke -->
      <rect x="18" y="18" width="764" height="464" rx="${cabinetRx}" fill="none" stroke="url(#cabinet-bevel)" stroke-width="4" />
    </g>
    <!-- Outer Bezel Border -->
    <rect x="18" y="18" width="764" height="464" rx="${cabinetRx}" fill="none" stroke="${tv.bezelDark}" stroke-width="3.5" />
  </g>

  <!-- CRT SCREEN RECESS & FRAME -->
  <g id="screen-frame">
    <rect x="34" y="32" width="550" height="436" rx="22" fill="${tv.bezelDark}" />
    <rect x="36" y="34" width="546" height="432" rx="20" fill="#0A0C0E" stroke="${tv.bezelLight}" stroke-width="1.5" stroke-opacity="0.25" />
    <rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" rx="14" fill="${screen.bg}" />
  </g>

  <!-- CRT CHANNELS CONTENT -->
  <g id="screen-viewport" clip-path="url(#screen-clip)">
    <clipPath id="screen-clip">
      <rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" rx="14" />
    </clipPath>

    <!-- Base CRT Phosphor Background -->
    <rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" fill="${screen.bg}" />

    <!-- CHANNEL 01: STATS -->
    <g class="ch ch-1">
      <!-- Top Status Bar (Clean, no CH01) -->
      <text x="68" y="80" class="crt-text glow" fill="${screen.bright}" font-size="26" font-weight="bold">SYSTEM STATS</text>
      <!-- Live Status Indicator on Top Right -->
      <circle cx="538" cy="73" r="4" fill="${screen.bright}" class="glow" />
      <text x="526" y="80" class="crt-text" fill="${screen.dim}" font-size="16" text-anchor="end">SIGNAL ACTIVE</text>
      <line x1="68" y1="94" x2="548" y2="94" stroke="${screen.dim}" stroke-width="1.5" stroke-opacity="0.5" />

      <!-- Row 1: Contributions -->
      <g transform="translate(68, 126)">
        <text x="0" y="24" class="crt-text" fill="${screen.dim}" font-size="22" font-weight="bold">CONTRIBUTIONS</text>
        <line x1="170" y1="18" x2="330" y2="18" stroke="${screen.dim}" stroke-dasharray="3,4" stroke-opacity="0.35" />
        <text x="480" y="26" class="crt-text glow" fill="${screen.bright}" font-size="34" font-weight="bold" text-anchor="end">${formatNumber(stats.totalContributions)}</text>
      </g>
      <line x1="68" y1="174" x2="548" y2="174" stroke="${screen.dim}" stroke-width="1" stroke-opacity="0.3" />

      <!-- Row 2: Commits -->
      <g transform="translate(68, 200)">
        <text x="0" y="24" class="crt-text" fill="${screen.dim}" font-size="22" font-weight="bold">COMMITS</text>
        <line x1="120" y1="18" x2="330" y2="18" stroke="${screen.dim}" stroke-dasharray="3,4" stroke-opacity="0.35" />
        <text x="480" y="26" class="crt-text glow" fill="${screen.bright}" font-size="34" font-weight="bold" text-anchor="end">${formatNumber(stats.totalCommits)}</text>
      </g>
      <line x1="68" y1="248" x2="548" y2="248" stroke="${screen.dim}" stroke-width="1" stroke-opacity="0.3" />

      <!-- Row 3: Pull Requests -->
      <g transform="translate(68, 274)">
        <text x="0" y="24" class="crt-text" fill="${screen.dim}" font-size="22" font-weight="bold">PULL REQUESTS</text>
        <line x1="170" y1="18" x2="330" y2="18" stroke="${screen.dim}" stroke-dasharray="3,4" stroke-opacity="0.35" />
        <text x="480" y="26" class="crt-text glow" fill="${screen.bright}" font-size="34" font-weight="bold" text-anchor="end">${formatNumber(stats.totalPullRequests)}</text>
      </g>
      <line x1="68" y1="322" x2="548" y2="322" stroke="${screen.dim}" stroke-width="1" stroke-opacity="0.3" />

      <!-- Row 4: Followers -->
      <g transform="translate(68, 348)">
        <text x="0" y="24" class="crt-text" fill="${screen.dim}" font-size="22" font-weight="bold">FOLLOWERS</text>
        <line x1="130" y1="18" x2="330" y2="18" stroke="${screen.dim}" stroke-dasharray="3,4" stroke-opacity="0.35" />
        <text x="480" y="26" class="crt-text glow" fill="${screen.bright}" font-size="34" font-weight="bold" text-anchor="end">${formatNumber(stats.followers)}</text>
      </g>

      <!-- Bottom Signal Banner -->
      <g transform="translate(68, 418)">
        <text x="0" y="16" class="crt-text" fill="${screen.dim}" font-size="17">STATUS: ON AIR</text>
        <text x="480" y="16" class="crt-text" fill="${screen.dim}" font-size="17" text-anchor="end">FEED: 100% ONLINE</text>
      </g>
    </g>

    <!-- CHANNEL 02: LANGUAGES -->
    <g class="ch ch-2">
      <!-- Top Status Bar (Clean, no CH02) -->
      <text x="68" y="80" class="crt-text glow" fill="${screen.bright}" font-size="26" font-weight="bold">TOP LANGUAGES</text>
      <line x1="68" y1="94" x2="548" y2="94" stroke="${screen.dim}" stroke-width="1.5" stroke-opacity="0.5" />

      <!-- Language Bars (Top 5) -->
      ${stats.languages.slice(0, 5).map((lang, idx) => {
    const rowY = 126 + idx * 54;
    const bar = generateSegmentedBar(lang.percentage, 18);
    const nameClean = (lang.name || "OTHER").toUpperCase().slice(0, 10).padEnd(10, " ");
    const percentStr = `${Math.round(lang.percentage)}%`.padStart(4, " ");
    return `
        <g transform="translate(68, ${rowY})">
          <!-- Language Name -->
          <text x="0" y="20" class="crt-text" fill="${screen.primary}" font-size="22" font-weight="bold">${escapeXml(nameClean)}</text>
          
          <!-- Segmented Phosphor Bar -->
          <g transform="translate(130, 4)">
            ${Array.from({ length: 18 }).map((_, segIdx) => {
      const segX = segIdx * 16;
      const isFilled = segIdx < bar.filled;
      const segFill = isFilled ? segIdx > 14 ? screen.bright : screen.primary : screen.dim;
      const segOpacity = isFilled ? segIdx > 14 ? "1.0" : "0.90" : "0.22";
      const filterAttr = isFilled && segIdx > 14 ? 'filter="url(#glow)"' : "";
      return `<rect x="${segX}" y="0" width="12" height="20" rx="2" fill="${segFill}" opacity="${segOpacity}" ${filterAttr} />`;
    }).join("")}
          </g>

          <!-- Percentage -->
          <text x="480" y="20" class="crt-text glow" fill="${screen.bright}" font-size="24" font-weight="bold" text-anchor="end">${percentStr}</text>
        </g>
        <line x1="68" y1="${rowY + 36}" x2="548" y2="${rowY + 36}" stroke="${screen.dim}" stroke-width="1" stroke-opacity="0.25" />
        `;
  }).join("")}

      <!-- Bottom Legend -->
      <g transform="translate(68, 418)">
        <text x="0" y="16" class="crt-text" fill="${screen.dim}" font-size="17">CODE SPECTRUM ANALYZER</text>
        <text x="480" y="16" class="crt-text" fill="${screen.dim}" font-size="17" text-anchor="end">TOTAL: 100%</text>
      </g>
    </g>

    <!-- CHANNEL 03: NOW SHOWING (FEATURED REPO) -->
    <g class="ch ch-3">
      <!-- Top Status Bar (Clean, no CH03) -->
      <text x="68" y="80" class="crt-text glow" fill="${screen.bright}" font-size="26" font-weight="bold">NOW SHOWING</text>
      <text x="548" y="80" class="crt-text" fill="${screen.dim}" font-size="16" text-anchor="end">SPOTLIGHT</text>
      <line x1="68" y1="94" x2="548" y2="94" stroke="${screen.dim}" stroke-width="1.5" stroke-opacity="0.5" />

      <!-- Repository Banner Box -->
      <rect x="68" y="112" width="480" height="74" rx="6" fill="${screen.dim}" fill-opacity="0.14" stroke="${screen.dim}" stroke-width="1.5" stroke-opacity="0.4" />
      
      <!-- Repo Name Tag -->
      <text x="86" y="136" class="crt-text" fill="${screen.dim}" font-size="16" font-weight="bold">FEATURED REPOSITORY</text>
      <text x="86" y="170" class="crt-text glow" fill="${screen.bright}" font-size="32" font-weight="bold">${escapeXml(stats.featuredRepo.name.toUpperCase())}</text>

      <!-- Description Block -->
      <g transform="translate(68, 214)">
        <text x="0" y="16" class="crt-text" fill="${screen.dim}" font-size="16" font-weight="bold">SYNOPSIS / LOG:</text>
        ${(() => {
    const lines = wrapText(stats.featuredRepo.description || "No description available for this repository.", 35, 3);
    return lines.map((line, lIdx) => {
      return `<text x="0" y="${46 + lIdx * 28}" class="crt-text" fill="${screen.primary}" font-size="22">${escapeXml(line)}</text>`;
    }).join("");
  })()}
      </g>

      <!-- Bottom Metadata Bar -->
      <g transform="translate(68, 342)">
        <rect x="0" y="0" width="480" height="52" rx="6" fill="${screen.dim}" fill-opacity="0.14" stroke="${screen.dim}" stroke-width="1.5" stroke-opacity="0.4" />
        
        <!-- Star Icon & Count -->
        <g transform="translate(20, 16)">
          <polygon points="9,0 12,6 18,7 13.5,12 15,18 9,14.5 3,18 4.5,12 0,7 6,6" fill="${screen.bright}" class="glow" />
          <text x="28" y="15" class="crt-text glow" fill="${screen.bright}" font-size="22" font-weight="bold">${formatNumber(stats.featuredRepo.stars)} STARS</text>
        </g>

        <!-- Fork Icon & Count -->
        <g transform="translate(200, 16)">
          <circle cx="4" cy="4" r="3" fill="${screen.primary}" />
          <circle cx="16" cy="4" r="3" fill="${screen.primary}" />
          <circle cx="10" cy="15" r="3" fill="${screen.primary}" />
          <path d="M 4 4 L 4 8 Q 4 11 10 11 L 10 15 M 16 4 L 16 8 Q 16 11 10 11" fill="none" stroke="${screen.primary}" stroke-width="2" />
          <text x="28" y="15" class="crt-text" fill="${screen.primary}" font-size="22" font-weight="bold">${formatNumber(stats.featuredRepo.forks)} FORKS</text>
        </g>

        <!-- Primary Language Tag -->
        ${stats.featuredRepo.primaryLanguage ? `
        <g transform="translate(370, 16)">
          <text x="94" y="15" class="crt-text glow" fill="${screen.bright}" font-size="20" font-weight="bold" text-anchor="end">${escapeXml(stats.featuredRepo.primaryLanguage.toUpperCase())}</text>
        </g>
        ` : ""}
      </g>

      <!-- Bottom Channel Footer -->
      <g transform="translate(68, 418)">
        <text x="0" y="16" class="crt-text" fill="${screen.dim}" font-size="17">STATUS: ARCHIVED</text>
        <text x="480" y="16" class="crt-text" fill="${screen.dim}" font-size="17" text-anchor="end">RATING: 5.0 / 5.0</text>
      </g>
    </g>

    <!-- CHANNEL 04: ACTIVITY (CONTRIBUTION HEATMAP) -->
    <g class="ch ch-4">
      <!-- Top Status Bar (Clean, no CH04) -->
      <text x="68" y="80" class="crt-text glow" fill="${screen.bright}" font-size="26" font-weight="bold">TRANSMISSION ACTIVITY</text>
      <line x1="68" y1="94" x2="548" y2="94" stroke="${screen.dim}" stroke-width="1.5" stroke-opacity="0.5" />

      <!-- Days of Week Indicator Column (Left) -->
      <g transform="translate(68, 126)">
        <text x="0" y="24" class="crt-text" fill="${screen.dim}" font-size="16" font-weight="bold">MON</text>
        <text x="0" y="52" class="crt-text" fill="${screen.dim}" font-size="16" font-weight="bold">WED</text>
        <text x="0" y="80" class="crt-text" fill="${screen.dim}" font-size="16" font-weight="bold">FRI</text>
      </g>

      <!-- 26-Week x 7-Day Activity Grid -->
      <g transform="translate(104, 112)">
        ${weeksToDisplay.map((week, wIdx) => {
    const colX = wIdx * 17;
    return week.contributionDays.map((day, dIdx) => {
      const rowY = dIdx * 14;
      const style = getLevelStyle(day.contributionLevel);
      const filterAttr = style.filter !== "none" ? `filter="${style.filter}"` : "";
      return `<rect x="${colX}" y="${rowY}" width="13.5" height="10" rx="2" fill="${style.fill}" opacity="${style.opacity}" ${filterAttr}><title>${escapeXml(day.date)}: ${day.contributionCount} contributions</title></rect>`;
    }).join("");
  }).join("")}
      </g>

      <!-- Heatmap Density Legend -->
      <g transform="translate(104, 238)">
        <text x="0" y="12" class="crt-text" fill="${screen.dim}" font-size="16" font-weight="bold">LESS</text>
        <g transform="translate(44, 1)">
          <rect x="0" y="0" width="13.5" height="10" rx="2" fill="${screen.dim}" opacity="0.25" />
          <rect x="17" y="0" width="13.5" height="10" rx="2" fill="${screen.primary}" opacity="0.40" />
          <rect x="34" y="0" width="13.5" height="10" rx="2" fill="${screen.primary}" opacity="0.65" />
          <rect x="51" y="0" width="13.5" height="10" rx="2" fill="${screen.primary}" opacity="0.90" />
          <rect x="68" y="0" width="13.5" height="10" rx="2" fill="${screen.bright}" opacity="1.0" filter="url(#glow)" />
        </g>
        <text x="138" y="12" class="crt-text" fill="${screen.dim}" font-size="16" font-weight="bold">MORE</text>
      </g>

      <!-- 26 Weeks Contribution Banner -->
      <g transform="translate(68, 280)">
        <rect x="0" y="0" width="480" height="90" rx="6" fill="${screen.dim}" fill-opacity="0.14" stroke="${screen.dim}" stroke-width="1.5" stroke-opacity="0.4" />
        <text x="240" y="36" class="crt-text dim-glow" fill="${screen.primary}" font-size="20" font-weight="bold" text-anchor="middle">PAST 26 WEEKS RADAR</text>
        <text x="240" y="70" class="crt-text glow" fill="${screen.bright}" font-size="34" font-weight="bold" text-anchor="middle">${formatNumber(totalIn26Weeks)} CONTRIBUTIONS</text>
      </g>

      <!-- Bottom Channel Footer -->
      <g transform="translate(68, 418)">
        <text x="0" y="16" class="crt-text" fill="${screen.dim}" font-size="17">TEMPORAL RADAR FREQ: 6 MOS</text>
        <text x="480" y="16" class="crt-text" fill="${screen.dim}" font-size="17" text-anchor="end">STATUS: SYNCHRONIZED</text>
      </g>
    </g>

    <!-- DUAL CRT V-SYNC TRACKING BARS (Layered above stats/text, below glass glare & CRT filters) -->
    <rect class="vsync-bar-1" x="${screenX}" y="${screenY - vsyncH1 * 2}" width="${screenW}" height="${vsyncH1}" fill="rgba(0, 0, 0, 0.15)" pointer-events="none" />
    <rect class="vsync-bar-2" x="${screenX}" y="${screenY - vsyncH2 * 2}" width="${screenW}" height="${vsyncH2}" fill="rgba(0, 0, 0, 0.15)" pointer-events="none" />

    <!-- Light Static Grain Filter Overlay -->
    <rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" filter="url(#crt-static)" opacity="0.6" pointer-events="none" />

    <!-- Analog Static Flash Transition Glitch Overlay -->
    <rect class="static-flash" x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" fill="url(#static-flash-grad)" pointer-events="none" />

    <!-- Light CRT Scanline Pattern Overlay -->
    <rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" fill="url(#scanlines)" pointer-events="none" />

    <!-- Softened Curved Glass Vignette -->
    <rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" rx="14" fill="url(#crt-vignette)" pointer-events="none" />

    <!-- Soft Glass Reflection Highlight -->
    <path d="M 52 50 L 260 50 L 52 260 Z" fill="#FFFFFF" opacity="0.025" pointer-events="none" />
  </g>

  <!-- Inner Bezel Drop Shadow Overlay -->
  <rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" rx="14" fill="url(#inner-bezel-shadow)" pointer-events="none" stroke="${tv.bezelDark}" stroke-width="3" />

  <!-- CONTROL PANEL (RIGHT ~24%) -->
  <g id="control-panel">
    <line x1="592" y1="26" x2="592" y2="474" stroke="${tv.bezelDark}" stroke-width="2.5" />
    <line x1="594" y1="26" x2="594" y2="474" stroke="${tv.bezelLight}" stroke-width="1" stroke-opacity="0.3" />

    <!-- CH ROTARY KNOB -->
    <g id="knob-ch">
      <circle cx="${knobCenterX}" cy="${chKnobCenterY}" r="38" fill="url(#knob-rim)" stroke="${tv.bezelDark}" stroke-width="2" />
      
      <line x1="${knobCenterX - 34}" y1="${chKnobCenterY - 34}" x2="${knobCenterX - 28}" y2="${chKnobCenterY - 28}" stroke="${tv.labelColor}" stroke-width="2" stroke-linecap="round" opacity="0.8" />
      <line x1="${knobCenterX - 15}" y1="${chKnobCenterY - 44}" x2="${knobCenterX - 12}" y2="${chKnobCenterY - 37}" stroke="${tv.labelColor}" stroke-width="2" stroke-linecap="round" opacity="0.8" />
      <line x1="${knobCenterX + 15}" y1="${chKnobCenterY - 44}" x2="${knobCenterX + 12}" y2="${chKnobCenterY - 37}" stroke="${tv.labelColor}" stroke-width="2" stroke-linecap="round" opacity="0.8" />
      <line x1="${knobCenterX + 34}" y1="${chKnobCenterY - 34}" x2="${knobCenterX + 28}" y2="${chKnobCenterY - 28}" stroke="${tv.labelColor}" stroke-width="2" stroke-linecap="round" opacity="0.8" />

      <!-- Rotating Inner Dial with Pointer -->
      <g transform="translate(${knobCenterX}, ${chKnobCenterY})">
        <g class="knob-marker-ch">
          <!-- Inner Metallic Cap (Rotates with dial) -->
          <circle cx="0" cy="0" r="26" fill="url(#metallic-dial)" stroke="#111827" stroke-width="1.5" />
          <circle cx="0" cy="0" r="25" fill="none" stroke="${tv.bezelLight}" stroke-width="0.8" opacity="0.4" />

          ${knobType === "dot" ? `
          <!-- Glowing Pointer Dot -->
          <circle cx="0" cy="-17" r="3.5" fill="${screen.bright}" />
          <circle cx="0" cy="-17" r="1.8" fill="#FFFFFF" />
          ` : `
          <!-- High-Contrast Pointer Line (Pure crisp stroke, matching VOLUME) -->
          <line x1="0" y1="-6" x2="0" y2="-21" stroke="${screen.bright}" stroke-width="3" stroke-linecap="round" />
          `}

          <!-- Center Rivet -->
          <circle cx="0" cy="0" r="5" fill="#1F2937" stroke="#374151" stroke-width="1" />
        </g>
      </g>
      <text x="${knobCenterX}" y="${chKnobCenterY + 54}" class="crt-text" fill="${tv.labelColor}" font-size="16" font-weight="bold" text-anchor="middle">CH SELECT</text>
    </g>

    <!-- VOL ROTARY KNOB -->
    <g id="knob-vol">
      <circle cx="${knobCenterX}" cy="${volKnobCenterY}" r="32" fill="url(#knob-rim)" stroke="${tv.bezelDark}" stroke-width="2" />
      <g transform="translate(${knobCenterX}, ${volKnobCenterY})">
        <g transform="rotate(35)">
          <circle cx="0" cy="0" r="22" fill="url(#metallic-dial)" stroke="#111827" stroke-width="1.5" />
          <circle cx="0" cy="0" r="21" fill="none" stroke="${tv.bezelLight}" stroke-width="0.8" opacity="0.4" />
          ${knobType === "dot" ? `
          <circle cx="0" cy="-14" r="3" fill="${screen.bright}" />
          <circle cx="0" cy="-14" r="1.5" fill="#FFFFFF" />
          ` : `
          <line x1="0" y1="-5" x2="0" y2="-18" stroke="${screen.bright}" stroke-width="3" stroke-linecap="round" />
          `}
          <circle cx="0" cy="0" r="4" fill="#1F2937" stroke="#374151" stroke-width="1" />
        </g>
      </g>
      <text x="${knobCenterX}" y="${volKnobCenterY + 48}" class="crt-text" fill="${tv.labelColor}" font-size="16" font-weight="bold" text-anchor="middle">VOLUME</text>
    </g>

    <!-- SPEAKER GRILLE -->
    <g id="speaker-grille" transform="translate(624, 296)">
      ${[0, 12, 24, 36, 48, 60].map((y) => `
        <rect x="0" y="${y}" width="120" height="5.5" rx="2.5" fill="${tv.bezelDark}" />
        <line x1="2" y1="${y + 5.5}" x2="118" y2="${y + 5.5}" stroke="${tv.bezelLight}" stroke-width="0.8" stroke-opacity="0.35" />
      `).join("")}
    </g>

    <!-- POWER INDICATOR LED -->
    <g id="power-led" transform="translate(684, 384)">
      <circle cx="0" cy="0" r="5" fill="#111827" stroke="${tv.bezelDark}" stroke-width="1.5" />
      <circle cx="0" cy="0" r="3" fill="${screen.bright}" class="power-led" filter="url(#glow)" />
    </g>

    <!-- USERNAME EMBOSSED BADGE -->
    <g id="badge-plate" transform="translate(684, 436)">
      <rect x="-65" y="-18" width="130" height="28" rx="4" fill="${tv.bezelDark}" stroke="${tv.bezelLight}" stroke-width="1" stroke-opacity="0.4" />
      <text x="0" y="2" class="crt-text" fill="${tv.labelColor}" font-size="16" font-weight="bold" text-anchor="middle">${escapeXml(badgeText)}</text>
    </g>
  </g>
</svg>`;
}

// src/themes.ts
function parseHex(hex) {
  const cleanHex = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(cleanHex)) {
    return null;
  }
  let fullHex = cleanHex;
  if (cleanHex.length === 3) {
    fullHex = cleanHex.split("").map((c) => c + c).join("");
  }
  const num = parseInt(fullHex, 16);
  return {
    r: num >> 16 & 255,
    g: num >> 8 & 255,
    b: num & 255
  };
}
function rgbToHex({ r, g, b }) {
  const toHex = (c) => {
    const clamped = Math.max(0, Math.min(255, Math.round(c)));
    return clamped.toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
function rgbToHsl({ r, g, b }) {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) * 60;
        break;
      case gNorm:
        h = ((bNorm - rNorm) / delta + 2) * 60;
        break;
      case bNorm:
        h = ((rNorm - gNorm) / delta + 4) * 60;
        break;
    }
  }
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}
function hslToRgb({ h, s, l }) {
  const hNorm = (h % 360 + 360) % 360 / 360;
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const lNorm = Math.max(0, Math.min(100, l)) / 100;
  if (sNorm === 0) {
    const val = Math.round(lNorm * 255);
    return { r: val, g: val, b: val };
  }
  const hue2rgb = (p2, q2, t) => {
    let tNorm = t;
    if (tNorm < 0) tNorm += 1;
    if (tNorm > 1) tNorm += 1;
    if (tNorm < 1 / 6) return p2 + (q2 - p2) * 6 * tNorm;
    if (tNorm < 1 / 2) return q2;
    if (tNorm < 2 / 3) return p2 + (q2 - p2) * (2 / 3 - tNorm) * 6;
    return p2;
  };
  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const p = 2 * lNorm - q;
  return {
    r: Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hNorm) * 255),
    b: Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255)
  };
}
var SCREEN_PRESETS = {
  white: {
    primary: "#E2E8F0",
    bright: "#FFFFFF",
    dim: "#94A3B8",
    // High-contrast, clear silver for labels & secondary text
    bg: "#0A0E14"
  },
  yellow: {
    primary: "#FFB000",
    bright: "#FFD54F",
    dim: "#D4A024",
    bg: "#140D02"
  },
  amber: {
    primary: "#FFB000",
    bright: "#FFD54F",
    dim: "#D4A024",
    bg: "#140D02"
  },
  green: {
    primary: "#4AF626",
    bright: "#80FF66",
    dim: "#62D946",
    bg: "#051205"
  },
  cyan: {
    primary: "#00F0FF",
    bright: "#80F8FF",
    dim: "#38BDF8",
    bg: "#03141A"
  },
  magenta: {
    primary: "#FF4D88",
    bright: "#FF85AD",
    dim: "#F472B6",
    bg: "#14030A"
  },
  pink: {
    primary: "#FF4D88",
    bright: "#FF85AD",
    dim: "#F472B6",
    bg: "#14030A"
  },
  orange: {
    primary: "#FF6B1A",
    bright: "#FF9459",
    dim: "#FB923C",
    bg: "#140702"
  }
};
var TV_PRESETS = {
  charcoal: {
    body: "#26292E",
    bezelDark: "#15171A",
    bezelLight: "#3A3F47",
    labelColor: "#9CA3AF"
  },
  walnut: {
    body: "#6E472B",
    bezelDark: "#4A2E1B",
    bezelLight: "#8C5D3B",
    labelColor: "#D1B094"
  },
  beige: {
    body: "#D6C7B2",
    bezelDark: "#9E8F7B",
    bezelLight: "#EDE3D5",
    labelColor: "#4A4033"
  },
  mustard: {
    body: "#C98A27",
    bezelDark: "#8F5E12",
    bezelLight: "#E3A646",
    labelColor: "#3D2502"
  },
  crimson: {
    body: "#8F2424",
    bezelDark: "#5C1313",
    bezelLight: "#B33636",
    labelColor: "#F5C6C6"
  },
  navy: {
    body: "#1F344D",
    bezelDark: "#111E2E",
    bezelLight: "#2F4C70",
    labelColor: "#B0C9E6"
  }
};
function resolveScreenPalette(input = "white") {
  const normalized = input.trim().toLowerCase();
  if (SCREEN_PRESETS[normalized]) {
    return SCREEN_PRESETS[normalized];
  }
  const rgb = parseHex(input);
  if (!rgb) {
    return SCREEN_PRESETS.white;
  }
  const hsl = rgbToHsl(rgb);
  const primary = rgbToHex(rgb);
  const bright = rgbToHex(hslToRgb({
    h: hsl.h,
    s: Math.min(100, hsl.s + 10),
    l: Math.min(100, hsl.l + 18)
  }));
  const dim = rgbToHex(hslToRgb({
    h: hsl.h,
    s: Math.max(30, hsl.s * 0.75),
    l: Math.max(52, Math.min(72, hsl.l * 0.85))
  }));
  const bg = rgbToHex(hslToRgb({
    h: hsl.h,
    s: Math.min(45, hsl.s * 0.4),
    l: Math.max(4, Math.min(10, hsl.l * 0.12))
  }));
  return { primary, bright, dim, bg };
}
function resolveTVPalette(input = "charcoal") {
  const normalized = input.trim().toLowerCase();
  if (TV_PRESETS[normalized]) {
    return TV_PRESETS[normalized];
  }
  const rgb = parseHex(input);
  if (!rgb) {
    return TV_PRESETS.charcoal;
  }
  const hsl = rgbToHsl(rgb);
  const body = rgbToHex(rgb);
  const bezelDark = rgbToHex(hslToRgb({
    h: hsl.h,
    s: hsl.s,
    l: Math.max(0, hsl.l - 18)
  }));
  const bezelLight = rgbToHex(hslToRgb({
    h: hsl.h,
    s: hsl.s,
    l: Math.min(100, hsl.l + 14)
  }));
  const labelColor = hsl.l < 50 ? rgbToHex(hslToRgb({ h: hsl.h, s: Math.min(25, hsl.s), l: 75 })) : rgbToHex(hslToRgb({ h: hsl.h, s: Math.min(25, hsl.s), l: 20 }));
  return { body, bezelDark, bezelLight, labelColor };
}

// src/generate.ts
async function main() {
  console.log("[INIT] CathodeRayStats Generator starting...");
  const username = process.env.INPUT_USERNAME?.trim() || process.env.GITHUB_REPOSITORY_OWNER || process.env.GITHUB_ACTOR || "Cheese-Cheese";
  const rawTvColor = process.env.INPUT_TV_COLOR?.trim() || "charcoal";
  const rawScreenColor = process.env.INPUT_SCREEN_COLOR?.trim() || "white";
  const rawTvStyle = process.env.INPUT_TV_STYLE?.trim().toLowerCase() === "trinitron" ? "trinitron" : "classic";
  const showAntennas = process.env.INPUT_SHOW_ANTENNAS?.trim().toLowerCase() === "true";
  const featuredRepo = process.env.INPUT_FEATURED_REPO?.trim() || void 0;
  const durationInput = parseInt(process.env.INPUT_CHANNEL_DURATION || "4", 10);
  const channelDuration = isNaN(durationInput) || durationInput <= 0 ? 4 : durationInput;
  const rawChannel = process.env.INPUT_CHANNEL?.trim().toLowerCase() || "all";
  const validChannels = ["all", "1", "2", "3", "4"];
  const channel = validChannels.includes(rawChannel) ? rawChannel : "all";
  const rawKnobType = process.env.INPUT_KNOB_TYPE?.trim().toLowerCase();
  const knobType = rawKnobType === "dot" ? "dot" : "line";
  const badgeLabel = process.env.INPUT_BADGE_LABEL?.trim();
  const outputPath = process.env.INPUT_OUTPUT_PATH?.trim() || "dist/retro-tv.svg";
  const token = process.env.GITHUB_TOKEN?.trim() || process.env.INPUT_GITHUB_TOKEN?.trim();
  const timezoneOffsetMinutes = parseInt(process.env.INPUT_TIMEZONE_OFFSET || "0", 10) || 0;
  console.log(`[CFG] Target User: ${username}`);
  console.log(`[CFG] Screen Phosphor: ${rawScreenColor} | TV Cabinet: ${rawTvColor} | Style: ${rawTvStyle}`);
  console.log(`[CFG] Antennas: ${showAntennas} | Active Channel: ${channel} | Duration: ${channelDuration}s | Knob: ${knobType}`);
  console.log(`[CFG] Output Destination: ${outputPath} | Timezone Offset: ${timezoneOffsetMinutes}m`);
  const screenPalette = resolveScreenPalette(rawScreenColor);
  const tvPalette = resolveTVPalette(rawTvColor);
  const themeConfig = {
    screen: screenPalette,
    tv: tvPalette,
    tvStyle: rawTvStyle,
    showAntennas,
    channelDuration,
    channel,
    username,
    badgeLabel,
    knobType
  };
  console.log(`[DATA] Fetching profile stats for @${username}...`);
  const userStats = await fetchGitHubData(username, token, featuredRepo, timezoneOffsetMinutes);
  console.log(`[DATA] Stats loaded: ${userStats.totalContributions} contributions, ${userStats.languages.length} languages, repo "${userStats.featuredRepo.name}"`);
  console.log("[RENDER] Generating CRT animated SVG...");
  const svg = renderRetroTvSvg(userStats, themeConfig);
  const absoluteOut = path.resolve(process.cwd(), outputPath);
  const outDir = path.dirname(absoluteOut);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(absoluteOut, svg, "utf8");
  console.log(`[DONE] Successfully generated CathodeRayStats SVG at: ${outputPath} (${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB)`);
}
main().catch((err) => {
  console.error("[FAIL] Error executing CathodeRayStats Generator:", err);
  process.exit(1);
});
