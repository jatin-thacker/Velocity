module.exports = function safeAttach(world) {
  return (typeof world.attach === 'function') ? world.attach.bind(world) : async () => {};
};
