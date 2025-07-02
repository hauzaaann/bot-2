/**
 * 👾「 𝚅𝙾𝙻𝚃𝚄𝚁𝙰𝚇 」⚡ - A WhatsApp Bot
 * Copyright (c) 2024 Professor
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * Credits:
 * - Baileys Library by @adiwajshing
 * - Pair Code implementation inspired by TechGod143 & DGXEON
 */
require("./settings");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const chalk = require("chalk");
const FileType = require("file-type");
const path = require("path");
const axios = require("axios");
const {
    handleMessages,
    handleGroupParticipantUpdate,
    handleStatus,
} = require("./main");
const PhoneNumber = require("awesome-phonenumber");
const {
    imageToWebp,
    videoToWebp,
    writeExifImg,
    writeExifVid,
} = require("./lib/exif");
const {
    smsg,
    isUrl,
    generateMessageTag,
    getBuffer,
    getSizeMedia,
    fetch,
    await,
    sleep,
    reSize,
} = require("./lib/myfunc");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay,
} = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const pino = require("pino");
const readline = require("readline");
const { parsePhoneNumber } = require("libphonenumber-js");
const {
    PHONENUMBER_MCC,
} = require("@whiskeysockets/baileys/lib/Utils/generics");
const { rmSync, existsSync } = require("fs");
const { join } = require("path");

// Create a store object with required methods
const store = {
    messages: {},
    contacts: {},
    chats: {},
    groupMetadata: async (jid) => {
        return {};
    },
    bind: function (ev) {
        // Handle events
        ev.on("messages.upsert", ({ messages }) => {
            messages.forEach((msg) => {
                if (msg.key && msg.key.remoteJid) {
                    this.messages[msg.key.remoteJid] =
                        this.messages[msg.key.remoteJid] || {};
                    this.messages[msg.key.remoteJid][msg.key.id] = msg;
                }
            });
        });

        ev.on("contacts.update", (contacts) => {
            contacts.forEach((contact) => {
                if (contact.id) {
                    this.contacts[contact.id] = contact;
                }
            });
        });

        ev.on("chats.set", (chats) => {
            this.chats = chats;
        });
    },
    loadMessage: async (jid, id) => {
        return this.messages[jid]?.[id] || null;
    },
};

let phoneNumber = "911234567890";
let owner = JSON.parse(fs.readFileSync("./data/owner.json"));

global.botname = "👾「 𝚅𝙾𝙻𝚃𝚄𝚁𝙰𝚇 」⚡";
global.themeemoji = "•";

const settings = require("./settings");
const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code");
const useMobile = process.argv.includes("--mobile");

// Only create readline interface if we're in an interactive environment
const rl = process.stdin.isTTY
    ? readline.createInterface({ input: process.stdin, output: process.stdout })
    : null;
const question = (text) => {
    if (rl) {
        return new Promise((resolve) => rl.question(text, resolve));
    } else {
        // In non-interactive environment, use ownerNumber from settings
        return Promise.resolve(settings.ownerNumber || phoneNumber);
    }
};

async function startXeonBotInc() {
    let { version, isLatest } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(`./session`);
    const msgRetryCounterCache = new NodeCache();

    const XeonBotInc = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: !pairingCode,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(
                state.keys,
                pino({ level: "fatal" }).child({ level: "fatal" }),
            ),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
            let jid = jidNormalizedUser(key.remoteJid);
            let msg = await store.loadMessage(jid, key.id);
            return msg?.message || "";
        },
        msgRetryCounterCache,
        defaultQueryTimeoutMs: undefined,
    });

    store.bind(XeonBotInc.ev);

    // Message handling
    XeonBotInc.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message) return;
            mek.message =
                Object.keys(mek.message)[0] === "ephemeralMessage"
                    ? mek.message.ephemeralMessage.message
                    : mek.message;
            if (mek.key && mek.key.remoteJid === "status@broadcast") {
                await handleStatus(XeonBotInc, chatUpdate);
                return;
            }
            if (
                !XeonBotInc.public &&
                !mek.key.fromMe &&
                chatUpdate.type === "notify"
            )
                return;
            if (mek.key.id.startsWith("BAE5") && mek.key.id.length === 16)
                return;

                try {
                    const mek = chatUpdate.messages?.[0]; // ✅ Tambahkan ini

                    try {
                        await handleMessages(XeonBotInc, chatUpdate, true);
                    } catch (err) {
                        console.error("Error in handleMessages:", err);

                        // Kirim notifikasi error hanya jika ada chatId yang valid
                        if (mek?.key?.remoteJid) {
                            await XeonBotInc.sendMessage(mek.key.remoteJid, {
                                text: "⚠️ Oops! Terdapat kesalahan saat memproses pesan kamu.",
                            }).catch(console.error);
                        }
                    }
                } catch (err) {
                    console.error("🚨 Terjadi kesalahan saat memproses chatUpdate:", err);
                

            }
        } catch (err) {
            console.error("🚨 Terjadi kesalahan saat memproses pesan:", err);
        }
    });

    // Add these event handlers for better functionality
    XeonBotInc.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {};
            return (
                (decode.user &&
                    decode.server &&
                    decode.user + "@" + decode.server) ||
                jid
            );
        } else return jid;
    };

    XeonBotInc.ev.on("contacts.update", (update) => {
        for (let contact of update) {
            let id = XeonBotInc.decodeJid(contact.id);
            if (store && store.contacts)
                store.contacts[id] = { id, name: contact.notify };
        }
    });

    XeonBotInc.getName = (jid, withoutContact = false) => {
        id = XeonBotInc.decodeJid(jid);
        withoutContact = XeonBotInc.withoutContact || withoutContact;
        let v;
        if (id.endsWith("@g.us"))
            return new Promise(async (resolve) => {
                v = store.contacts[id] || {};
                if (!(v.name || v.subject))
                    v = XeonBotInc.groupMetadata(id) || {};
                resolve(
                    v.name ||
                        v.subject ||
                        PhoneNumber(
                            "+" + id.replace("@s.whatsapp.net", ""),
                        ).getNumber("international"),
                );
            });
        else
            v =
                id === "0@s.whatsapp.net"
                    ? {
                          id,
                          name: "WhatsApp",
                      }
                    : id === XeonBotInc.decodeJid(XeonBotInc.user.id)
                      ? XeonBotInc.user
                      : store.contacts[id] || {};
        return (
            (withoutContact ? "" : v.name) ||
            v.subject ||
            v.verifiedName ||
            PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber(
                "international",
            )
        );
    };

    XeonBotInc.public = true;

    XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store);

    // Handle pairing code
    if (pairingCode && !XeonBotInc.authState.creds.registered) {
        if (useMobile)
            throw new Error(
                "🚫 Tidak dapat menggunakan pairing code dengan Mobile API",
            );

        let phoneNumber;
        if (!!global.phoneNumber) {
            phoneNumber = global.phoneNumber;
        } else {
            phoneNumber = await question(
                chalk.bgBlack(
                    chalk.greenBright(
                        `📞 Masukkan nomor WhatsApp kamu:\nContoh: 6281376552730 (tanpa + atau spasi) ➤ : `,
                    ),
                ),
            );
        }

        // Clean the phone number - remove any non-digit characters
        phoneNumber = phoneNumber.replace(/[^0-9]/g, "");

        // Validate the phone number using awesome-phonenumber
        const pn = require("awesome-phonenumber");
        if (!pn("+" + phoneNumber).isValid()) {
            console.log(
                chalk.red(
                    "📛 Nomor tidak valid! Masukkan nomor internasional lengkap tanpa + atau spasi.\nContoh: 6281234567890 (Indonesia)",
                ),
            );
            process.exit(1);
        }

        setTimeout(async () => {
            try {
                let code = await XeonBotInc.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(
                    chalk.black(chalk.bgGreen(`🔑 Kode Pairing Kamu:`)),
                    chalk.black(chalk.white(code)),
                );
                console.log(
                    chalk.yellow(
                        `📲 Silakan masukkan kode ini ke aplikasi WhatsApp kamu:\n\n1️⃣ Buka WhatsApp\n2️⃣ Masuk ke *Pengaturan > Perangkat Tertaut*\n3️⃣ Ketuk *"Tautkan Perangkat"*\n4️⃣ Masukkan kode pairing di atas 🔐`,
                    ),
                );
            } catch (error) {
                console.error("Error requesting pairing code:", error);
                console.log(
                    chalk.red(
                        "❌ Gagal mendapatkan kode pairing!\n📞 Periksa kembali nomor WhatsApp kamu dan coba lagi.",
                    ),
                );
            }
        }, 3000);
    }

    // Connection handling
    XeonBotInc.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection == "open") {
            console.log(chalk.magenta(` `));
            console.log(
                chalk.yellow(
                    `⚡ Terhubung ke ➤` +
                        JSON.stringify(XeonBotInc.user, null, 2),
                ),
            );

            const botNumber =
                XeonBotInc.user.id.split(":")[0] + "@s.whatsapp.net";
            await XeonBotInc.sendMessage(botNumber, {
                text: `🤖 Bot berhasil terhubung!\n\n⏰ Waktu: ${new Date().toLocaleString()}\n✅ Status: Online & Siap digunakan!
                \n📢 Jangan lupa join channel di bawah ini:`,
             }).catch(console.error);
            }


            await delay(1999);
            console.log(
                chalk.yellow(
                    `\n\n╭═━[ ⚡ ${chalk.bold("VOLTURAX CONTROL PANEL")} ⚡ ]━═╮`,
                ),
            );
            console.log(
                chalk.yellow(`┃👾${chalk.bold("*Bot Name:*")} 「 𝚅𝙾𝙻𝚃𝚄𝚁𝙰𝚇 」`),
            );
            console.log(
                chalk.yellow(
                    `┃👨‍💻${chalk.bold("*Developer:*")} Hauzan Dzakwan Kh`,
                ),
            );
            console.log(
                chalk.yellow(`┃📱 ${chalk.bold("*WhatsApp:*")} 088224981010`),
            );
            console.log(
                chalk.yellow(`┃📸 ${chalk.bold("*Instagram:*")} @hauzaann__`),
            );
            console.log(
                chalk.yellow(`┃💻 ${chalk.bold("*GitHub:*")} hauzaaann`),
            );
            console.log(chalk.yellow(`╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`));
            console.log(
                chalk.green(
                    `${global.themeemoji || "✅"} 🤖 Bot berhasil terhubung! Sistem siap digunakan ⚡✅\n`,
                ),
            );
        
        if (
            connection === "close" &&
            lastDisconnect &&
            lastDisconnect.error &&
            lastDisconnect.error.output.statusCode != 401
        ) {
            startXeonBotInc();
        }
    });

    XeonBotInc.ev.on("creds.update", saveCreds);

    XeonBotInc.ev.on("group-participants.update", async (update) => {
        await handleGroupParticipantUpdate(XeonBotInc, update);
    });

    XeonBotInc.ev.on("messages.upsert", async (m) => {
        if (
            m.messages[0].key &&
            m.messages[0].key.remoteJid === "status@broadcast"
        ) {
            await handleStatus(XeonBotInc, m);
        }
    });

    XeonBotInc.ev.on("status.update", async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    XeonBotInc.ev.on("messages.reaction", async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    return XeonBotInc;
}

// Start the bot with error handling
startXeonBotInc().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err);
});

let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log(chalk.redBright(`Update ${__filename}`));
    delete require.cache[file];
    require(file);
});
